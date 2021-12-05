---
date: "2014-04-09"
title: "Path"
type: 1
---

“Just be patient”

<!-- Styles -->
<style>
#chartdiv {
  width: 100%;
  height: 500px;
  overflow: hidden;
}
</style>

<!-- Resources -->
<script src="https://cdn.amcharts.com/lib/4/core.js"></script>
<script src="https://cdn.amcharts.com/lib/4/maps.js"></script>
<script src="https://cdn.amcharts.com/lib/4/geodata/worldLow.js"></script>
<script src="https://cdn.amcharts.com/lib/4/themes/animated.js"></script>

<!-- Chart code -->
<script>
am4core.ready(function() {

// Themes begin
am4core.useTheme(am4themes_animated);
// Themes end

// Create map instance
var chart = am4core.create("chartdiv", am4maps.MapChart);

// Set map definition
chart.geodata = am4geodata_worldLow;

// Set projection
chart.projection = new am4maps.projections.Miller();

// Create map polygon series
var polygonSeries = chart.series.push(new am4maps.MapPolygonSeries());

// Exclude Antartica
polygonSeries.exclude = ["AQ"];

// Make map load polygon (like country names) data from GeoJSON
polygonSeries.useGeodata = true;

// Configure series
var polygonTemplate = polygonSeries.mapPolygons.template;
polygonTemplate.tooltipText = "{name}";
polygonTemplate.polygon.fillOpacity = 0.6;
polygonTemplate.fill = "#ffffff";

// Create hover state and set alternative fill color
var hs = polygonTemplate.states.create("hover");
hs.properties.fill = chart.colors.getIndex(0);

// Add image series
var imageSeries = chart.series.push(new am4maps.MapImageSeries());
imageSeries.mapImages.template.propertyFields.longitude = "longitude";
imageSeries.mapImages.template.propertyFields.latitude = "latitude";
imageSeries.mapImages.template.tooltipText = "{title}";
imageSeries.mapImages.template.propertyFields.url = "url";

var circle = imageSeries.mapImages.template.createChild(am4core.Circle);
circle.radius = 1;
circle.propertyFields.fill = "color";
circle.nonScaling = true;

var circle2 = imageSeries.mapImages.template.createChild(am4core.Circle);
circle2.radius = 2;
circle2.propertyFields.fill = "color";


circle2.events.on("inited", function(event){
  animateBullet(event.target);
})




function animateBullet(circle) {
    var animation = circle.animate([{ property: "scale", from: 1 / chart.zoomLevel, to: 2 / chart.zoomLevel }, { property: "opacity", from: 1, to: 0 }], 3000, am4core.ease.circleOut);
    animation.events.on("animationended", function(event){
      animateBullet(event.target.object);
    })
}

var colorSet = new am4core.ColorSet();

imageSeries.data = [ {
  "title": "ShenZhen",
  "latitude": 22.565880522089515,
  "longitude": 113.9709282556999,
  "color" : "black"
},{
  "title": "BeiJing",
  "latitude": 39.902579359578304,
  "longitude": 116.41245737300063,
  "color" : "black"
},{
  "title": "ShangHai",
  "latitude": 31.119469055381533,
  "longitude": 121.42179039062488,
  "color" : "black"
},{
  "title": "KunMing",
  "latitude": 25.046829352637896,
  "longitude": 102.70602372475848,
  "color" : "black"
},{
  "title": "Changsha",
  "latitude": 28.228704407228285,
  "longitude": 112.94287851785356,
  "color" : "black"
},{
  "title": "WuHan",
  "latitude": 30.484402947730427,
  "longitude": 114.42310565310315,
  "color" : "black"
},{
  "title": "NanJing",
  "latitude": 31.999638525692653,
  "longitude": 118.81166013032207,
  "color" : "black"
}

];

polygonSeries.data = [{
  "id": "CN",
  "name": "China",
  "value": 100,
  "fill": am4core.color("#F05C5C"),
  "strokeWidth": 4
},{
  "id": "TW",
  "name": "China",
  "value": 100,
  "fill": am4core.color("#F05C5C")
},{
  "id": "HK",
  "name": "China",
  "value": 100,
  "fill": am4core.color("#F05C5C")
}
];
polygonTemplate.propertyFields.fill = "fill";

let grid = chart.series.push(new am4maps.GraticuleSeries());
grid.toBack();
grid.mapLines.template.line.stroke = am4core.color("#e33");
grid.mapLines.template.line.strokeOpacity = 0.2;
polygonTemplate.stroke = am4core.color("#aaa");
polygonTemplate.strokeWidth = 1;



var usaSeries = chart.series.push(new am4maps.MapPolygonSeries());
usaSeries.geodata = am4geodata_worldChinaLow


}); // end am4core.ready()\
</script>

<!-- HTML -->
<div id="chartdiv"></div>