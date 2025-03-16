# H3 Vector Testing App

An interactive application for generating, visualizing, and exporting H3 geospatial hexagons as vector data.

## Features

- Generate H3 hexagons at different resolutions (0-8)
- Visualize hexagons for different geographic regions
- Inspect individual hexagon properties
- Export data as GeoJSON and SVG
- Highlight special properties like pentagons
- Show multipolygon outlines

## Installation

1. Clone this repository
2. Install dependencies:
```
npm install
```
3. Start the development server:
```
npm start
```

## Usage

- Select a resolution from 0 (coarsest) to 8 (finest)
- Choose a geographic region to focus on
- Use the color mode selector to visualize different hexagon properties
- Click on any hexagon to see its details
- Use the export buttons to get GeoJSON or SVG output

## Dependencies

- React
- h3-js
- TailwindCSS

## Structure

- `H3VectorTestApp.js` - Main component with all functionality
- `App.js` - Application wrapper
- CSS and configuration files

## Learn More

- [H3 Documentation](https://h3geo.org/)
- [h3-js on GitHub](https://github.com/uber/h3-js)
