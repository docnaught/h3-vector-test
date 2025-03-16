import React, { useState, useEffect } from 'react';
import { 
  latLngToCell, 
  cellToLatLng, 
  cellToBoundary, 
  getResolution, 
  getRes0Cells, 
  cellToChildren,
  cellsToMultiPolygon,
  isPentagon
} from 'h3-js';

const H3VectorTestApp = () => {
  // State for the app
  const [resolution, setResolution] = useState(1);
  const [region, setRegion] = useState('global');
  const [hexagons, setHexagons] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHexagon, setSelectedHexagon] = useState(null);
  const [svgWidth, setSvgWidth] = useState(800);
  const [svgHeight, setSvgHeight] = useState(500);
  const [showOutline, setShowOutline] = useState(false);
  const [colorMode, setColorMode] = useState('fixed');
  const [stats, setStats] = useState({});

  // Predefined regions with bounds [west, south, east, north]
  const regions = {
    global: [-180, -90, 180, 90],
    northAmerica: [-170, 5, -50, 70],
    europe: [-10, 35, 40, 70],
    asia: [60, 0, 150, 60],
    africa: [-20, -35, 50, 37],
    southAmerica: [-85, -60, -30, 15],
    australia: [110, -45, 155, -10]
  };

  // Generate hexagons when resolution or region changes
  useEffect(() => {
    generateHexagons();
  }, [resolution, region]);

  // Function to generate hexagons based on resolution and region
  const generateHexagons = () => {
    setIsLoading(true);
    setSelectedHexagon(null);

    // Use setTimeout to avoid blocking the UI
    setTimeout(() => {
      try {
        // Calculate the max hexagons based on resolution
        const maxHexagons = resolution <= 2 ? 10000 : 
                           resolution <= 4 ? 5000 : 
                           resolution <= 6 ? 1000 : 500;

        // Get the bounds for the selected region
        const bounds = regions[region];
        
        // Generate starting cells
        let h3Cells = [];
        
        if (region === 'global') {
          // Start with base cells (resolution 0)
          let baseCells = getRes0Cells();
          
          if (resolution === 0) {
            h3Cells = baseCells;
          } else {
            // For low resolutions, we can expand all base cells
            if (resolution <= 3) {
              for (const baseCell of baseCells) {
                const children = cellToChildren(baseCell, resolution);
                h3Cells.push(...children);
                if (h3Cells.length > maxHexagons) break;
              }
            }
            // For higher resolutions, generate a grid of points and convert to cells
            else {
              const latStep = 180 / Math.sqrt(maxHexagons);
              const lngStep = 360 / Math.sqrt(maxHexagons);
              
              for (let lat = -90; lat <= 90; lat += latStep) {
                for (let lng = -180; lng <= 180; lng += lngStep) {
                  const cell = latLngToCell(lat, lng, resolution);
                  h3Cells.push(cell);
                  if (h3Cells.length >= maxHexagons) break;
                }
                if (h3Cells.length >= maxHexagons) break;
              }
              
              // Remove duplicates
              h3Cells = [...new Set(h3Cells)];
            }
          }
        } else {
          // For specific regions, generate a grid of points within the region bounds
          const latRange = bounds[3] - bounds[1];
          const lngRange = bounds[2] - bounds[0];
          
          // Calculate number of points based on resolution and region size
          const numPoints = Math.min(maxHexagons, 100 * Math.pow(3, resolution));
          const latStep = latRange / Math.sqrt(numPoints / (lngRange / latRange));
          const lngStep = lngRange / Math.sqrt(numPoints / (latRange / lngRange));
          
          for (let lat = bounds[1]; lat <= bounds[3]; lat += latStep) {
            for (let lng = bounds[0]; lng <= bounds[2]; lng += lngStep) {
              const cell = latLngToCell(lat, lng, resolution);
              h3Cells.push(cell);
              if (h3Cells.length >= maxHexagons) break;
            }
            if (h3Cells.length >= maxHexagons) break;
          }
          
          // Remove duplicates
          h3Cells = [...new Set(h3Cells)];
        }
        
        // Set hexagons and calculate stats
        setHexagons(h3Cells);
        calculateStats(h3Cells);
      } catch (error) {
        console.error("Error generating hexagons:", error);
        setHexagons([]);
        setStats({});
      } finally {
        setIsLoading(false);
      }
    }, 10);
  };

  // Calculate statistics about the hexagons
  const calculateStats = (h3Cells) => {
    const pentagons = h3Cells.filter(cell => isPentagon(cell));
    const totalArea = h3Cells.length > 0 ? h3Cells.length * getApproxHexagonArea(resolution) : 0;
    
    setStats({
      count: h3Cells.length,
      pentagons: pentagons.length,
      resolution,
      approxArea: totalArea.toFixed(2)
    });
  };

  // Get approximate area of a hexagon at a given resolution (km²)
  const getApproxHexagonArea = (res) => {
    // These are approximations based on H3 documentation
    const areas = [
      4250546.8477, // res 0
      607220.9782,  // res 1
      86745.8540,   // res 2
      12392.2663,   // res 3
      1770.3095,    // res 4
      252.9014,     // res 5
      36.1292,      // res 6
      5.1613,       // res 7
      0.7373,       // res 8
      0.1053,       // res 9
      0.0150        // res 10
    ];
    
    return res < areas.length ? areas[res] : areas[areas.length - 1] / Math.pow(7, res - areas.length + 1);
  };

  // Convert lat/lng to SVG coordinates
  const geoToSvg = (lat, lng) => {
    const bounds = regions[region];
    const padding = 50;
    
    // For global view, use a simple Mercator projection
    if (region === 'global') {
      const x = (lng + 180) * (svgWidth - 2 * padding) / 360 + padding;
      
      // Mercator formula for y coordinate
      const latRad = lat * Math.PI / 180;
      const mercN = Math.log(Math.tan((Math.PI / 4) + (latRad / 2)));
      const y = (svgHeight / 2) - ((svgWidth - 2 * padding) * mercN / (2 * Math.PI)) + padding;
      
      return [x, y];
    } else {
      // For regional view, use a simple linear mapping
      const x = ((lng - bounds[0]) / (bounds[2] - bounds[0])) * (svgWidth - 2 * padding) + padding;
      const y = svgHeight - (((lat - bounds[1]) / (bounds[3] - bounds[1])) * (svgHeight - 2 * padding) + padding);
      return [x, y];
    }
  };

  // Generate SVG path for a hexagon
  const hexagonToPath = (h3Index) => {
    const boundary = cellToBoundary(h3Index);
    const path = boundary.map((point, i) => {
      const [x, y] = geoToSvg(point[0], point[1]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
    return `${path} Z`;
  };

  // Get color for a hexagon based on the selected color mode
  const getHexagonColor = (h3Index) => {
    if (selectedHexagon === h3Index) return "#fc8d59";
    
    switch (colorMode) {
      case 'fixed':
        return "#91bfdb";
      case 'random':
        // Generate a deterministic "random" color based on the hash of the h3Index
        const hash = h3Index.split('').reduce((acc, char) => {
          return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        return `hsl(${hash % 360}, 70%, 70%)`;
      case 'pentagon':
        return isPentagon(h3Index) ? "#ff6b6b" : "#91bfdb";
      default:
        return "#91bfdb";
    }
  };

  // Hexagon click handler
  const handleHexagonClick = (hexagon) => {
    setSelectedHexagon(selectedHexagon === hexagon ? null : hexagon);
  };

  // Export GeoJSON function
  const exportGeoJSON = () => {
    const features = hexagons.map(h3Index => {
      const boundary = cellToBoundary(h3Index, true); // GeoJSON format
      const center = cellToLatLng(h3Index, true);
      
      return {
        type: 'Feature',
        properties: {
          h3Index,
          resolution: getResolution(h3Index),
          isPentagon: isPentagon(h3Index)
        },
        geometry: {
          type: 'Polygon',
          coordinates: [boundary]
        }
      };
    });
    
    const geojson = {
      type: 'FeatureCollection',
      features
    };
    
    const blob = new Blob([JSON.stringify(geojson, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h3-hexagons-res${resolution}-${region}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export SVG function
  const exportSVG = () => {
    const svgContent = document.getElementById('h3-map-svg').outerHTML;
    const blob = new Blob([svgContent], {type: 'image/svg+xml'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `h3-hexagons-res${resolution}-${region}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate multi-polygon outline
  const getMultiPolygonOutline = () => {
    if (hexagons.length === 0) return null;
    
    try {
      return cellsToMultiPolygon(hexagons, false);
    } catch (error) {
      console.error("Error creating multipolygon:", error);
      return null;
    }
  };

  // Render the app
  return (
    <div className="flex flex-col h-full">
      <div className="bg-gray-100 p-4 border-b border-gray-300">
        <h1 className="text-2xl font-bold mb-4">H3 Vector Testing App</h1>
        
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700">Resolution</label>
            <select 
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={resolution}
              onChange={(e) => setResolution(parseInt(e.target.value))}
              disabled={isLoading}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((res) => (
                <option key={res} value={res}>Resolution {res}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Region</label>
            <select 
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isLoading}
            >
              {Object.keys(regions).map((r) => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Color Mode</label>
            <select 
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value)}
              disabled={isLoading}
            >
              <option value="fixed">Single Color</option>
              <option value="random">Unique Colors</option>
              <option value="pentagon">Highlight Pentagons</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Options</label>
            <div className="mt-1 flex items-center">
              <input 
                type="checkbox" 
                id="outline" 
                checked={showOutline} 
                onChange={() => setShowOutline(!showOutline)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="outline" className="ml-2 block text-sm text-gray-900">
                Show Outline
              </label>
            </div>
          </div>
          
          <div className="flex items-end gap-2">
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={generateHexagons}
              disabled={isLoading}
            >
              {isLoading ? 'Generating...' : 'Regenerate'}
            </button>
            
            <button
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              onClick={exportGeoJSON}
              disabled={isLoading || hexagons.length === 0}
            >
              Export GeoJSON
            </button>
            
            <button
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              onClick={exportSVG}
              disabled={isLoading || hexagons.length === 0}
            >
              Export SVG
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-4">
          {isLoading ? (
            <span>Generating hexagons...</span>
          ) : (
            <>
              <span>Hexagons: {stats.count || 0}</span>
              <span>Pentagons: {stats.pentagons || 0}</span>
              <span>Resolution: {stats.resolution !== undefined ? stats.resolution : '-'}</span>
              <span>Approx. Area: {stats.approxArea || 0} km²</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden p-4 bg-gray-200">
        <div className="relative w-full h-full bg-white rounded shadow-md overflow-hidden">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
              <div className="text-xl font-semibold">Generating Hexagons...</div>
            </div>
          ) : hexagons.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white">
              <div className="text-xl font-semibold">No hexagons to display</div>
            </div>
          ) : (
            <svg 
              id="h3-map-svg"
              width={svgWidth} 
              height={svgHeight} 
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-full"
            >
              {/* Render each hexagon */}
              {hexagons.map((h3Index) => (
                <path
                  key={h3Index}
                  d={hexagonToPath(h3Index)}
                  fill={getHexagonColor(h3Index)}
                  stroke="#333333"
                  strokeWidth={0.5}
                  opacity={0.7}
                  onClick={() => handleHexagonClick(h3Index)}
                  className="cursor-pointer transition-colors duration-200"
                />
              ))}
              
              {/* Render multipolygon outline if enabled */}
              {showOutline && (
                <g>
                  {getMultiPolygonOutline()?.map((polygon, i) => (
                    <path
                      key={`outline-${i}`}
                      d={polygon.map((ring, j) => {
                        return ring.map((point, k) => {
                          const [x, y] = geoToSvg(point[0], point[1]);
                          return `${k === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ') + ' Z';
                      }).join(' ')}
                      fill="none"
                      stroke="#ff0000"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                    />
                  ))}
                </g>
              )}
            </svg>
          )}
          
          {/* Information panel for selected hexagon */}
          {selectedHexagon && (
            <div className="absolute top-4 right-4 bg-white p-4 rounded shadow-lg max-w-md">
              <h3 className="font-bold text-lg mb-2">Hexagon Details</h3>
              <p><strong>H3 Index:</strong> {selectedHexagon}</p>
              <p><strong>Resolution:</strong> {getResolution(selectedHexagon)}</p>
              <p><strong>Pentagon:</strong> {isPentagon(selectedHexagon) ? "Yes" : "No"}</p>
              <p>
                <strong>Center:</strong> {cellToLatLng(selectedHexagon).map(v => v.toFixed(6)).join(', ')}
              </p>
              <p>
                <strong>Vertices:</strong> {cellToBoundary(selectedHexagon).length}
              </p>
              <button 
                className="mt-2 bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-2 rounded text-sm"
                onClick={() => setSelectedHexagon(null)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default H3VectorTestApp;
