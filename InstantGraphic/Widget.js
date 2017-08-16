require({paths: {charts: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.6.0', palette: "https://codepen.io/anon/pen"}});

define(
  [
    'dojo/_base/declare',
    'dojo/on',
    'dojo/dom-class',
    'dojo/_base/lang',
    'dojo/topic',
    'dojo/io-query',
    "dojo/promise/all",

    // "dojox/charting/Chart", 
    // "dojox/charting/plot2d/Pie", 
    // "dojox/charting/action2d/Highlight",
    // "dojox/charting/action2d/MoveSlice", 
    // "dojox/charting/action2d/Tooltip",
    // "dojox/charting/themes/Harmony", 
    // "dojox/charting/widget/Legend",

    'dijit/_WidgetsInTemplateMixin',
    "dijit/_TemplatedMixin",
    'jimu/BaseWidget',

    'esri/config',
    "esri/toolbars/edit",
    "esri/layers/GraphicsLayer",
    "esri/layers/FeatureLayer",
    "esri/graphic",
    "esri/tasks/query",
    "esri/tasks/locator",
    "esri/geometry/Point",
    "esri/geometry/Polygon",
     "esri/symbols/SimpleFillSymbol", 
     "esri/symbols/SimpleLineSymbol", 
     "esri/Color",
    'jimu/LayerInfos/LayerInfos',
    'charts/Chart.min',
    'palette/aWapBE',
    'jimu/loaderplugins/jquery-loader!https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js'

  ], function (
    declare,on,domClass,lang,topic, ioQuery, all,
    // Chart, Pie, Highlight, MoveSlice, Tooltip, Harmony, Legend,
    WidgetsInTemplateMixin, TemplatedMixin, BaseWidget,
    esriConfig, Edit, GraphicsLayer, FeatureLayer, Graphic, Query, Locator, Point, Polygon,
    SimpleFillSymbol, SimpleLineSymbol, Color,
    LayerInfos, chart, Palette
  ) {
    // var $ = jquery.noConflict(true);
    var clazz = declare([BaseWidget, TemplatedMixin, WidgetsInTemplateMixin], {
        baseClass: 'jimu-widget-instantsummarize',
        view: 'one',

        postCreate: function() {
            this.inherited(arguments);
        },

        startup: function() {
            this.inherited(arguments);

            this.init();
        },

        init: function() {
            this.charts = [];
            this.legends = [];
            // this.boundaryLayer = this.map.getLayer(this.config.boundaryLayerID);
            // this.pointsLayer = this.map.getLayer(this.config.pointsLayerID);
            this.boundaryLayer = this._getOperationalLayer(this.config.boundaryLayerID);
            this.pointsLayer = this._getOperationalLayer(this.config.pointsLayerID);

            // store selected fields in widget object
            this.fields = this.config.fields.filter(function(field){
                return field.selected;
              });

            // add graph divs to widget
            for(var i = 1; i <= this.fields.length; i++){
              var graphicText = "<hr><canvas class='graphic' id='infographic" + i + "'></canvas>";
              graphicText += ("<div id='legend" + i + "'></div>");
              this.graphicContainer.innerHTML += graphicText;
            }
            
            this._attachEventListeners();

            $(this.viewNode).css({'height': $(window).height() - 123});                
        },

        _attachEventListeners: function() {
            this.editor = new Edit(this.map, {
              allowAddVertices: true,
              allowDeleteVertices: true
            });

            var clickFunction = lang.hitch(this, function(point, layer){
              var graphics = layer.graphics;
              var intersected = graphics.filter(function(graphic){
                  return graphic.geometry.contains(point);
              });

              // could be no graphics intersecting click
              if(intersected.length > 0){
                  // if graphics are points, ensures closest to click is used
                  var graphic = intersected[0];
                  
                  this._computeValues(graphic);
                  return graphic;
                  
              }
            });

            var activateEdit = lang.hitch(this, function(graphic){
              this.editor.activate(Edit.EDIT_VERTICES, graphic);
            });

            this.boundaryLayer.on("click", lang.hitch(this, function(evt){
              var point = evt.mapPoint;
              var layer = this.boundaryLayer;
              var graphic = clickFunction(point, layer);

              // activate editing
              if(this.config.editableBoundaries){
                this.editor.deactivate();
                if(graphic){
                  activateEdit(graphic);
                  this.editor.on("vertex-move-stop", lang.hitch(this, function(evt){
                    this._computeValues(evt.graphic);
                  }));
                }
              }
              

              // center and zoom on click
              var center = graphic.geometry.getExtent().getCenter();
              this.map.centerAndZoom(center, this.config.zoomLevel);
              
            }));

        },

        _getOperationalLayer(id){
          var layers = this.map.itemInfo.itemData.operationalLayers;
          for(var i = 0; i < layers.length; i++){
            var layer = layers[i];
            if(layer.id === id){
              return layer.layerObject;
            }
          }
        },

        _computeValues: function(boundary_graphic){
          var boundary_polygon = boundary_graphic.geometry;
          if(this.pointsLayer){
            var query = new Query();
            query.geometry = boundary_polygon;
            var fields = this.fields;
            var field_names = fields.map(function(field){
              return field.name;
            });
            query.outFields = field_names;

            var promise = this.pointsLayer.queryFeatures(query);
            promise.then(lang.hitch(this, function(result){
              var containedGraphics = result.features;
              this.values = [];
              var fields = this.fields;
              for(var i = 0; i < fields.length; i++){
                var field = fields[i];
                var field_name = field.name;
                var field_type = field.type;
                
                if(field_type === "esriFieldTypeString"){
                  // accumulate values across types
                  var output = {};
                  for(var j = 0; j < containedGraphics.length; j++){
                    graphic = containedGraphics[j];
                    var value = graphic.attributes[field_name];
                    if(!(value in output)){
                      output[value] = 0;
                    }
                    output[value] += 1;
                  }

                }
                else if(field_type === "number"){
                  var output = containedGraphics.map(function(graphic){
                    return graphic.attributes[field_name];
                  });
                }
                var object = {
                  "title": field_name,
                  "data": output
                };
                this.values.push(object);
              }
              if(this.config.showCount){
                $("#countNum").html(containedGraphics.length);
                $("#countLabel").html(this.config.countLabel);
              }

              this._renderGraph();
            })); 
        }
      },

      _renderGraph: function(){
        this._clearGraphs();
        this.charts = [];
        var j = 0;
        this.fields.forEach(lang.hitch(this, function(field){
          j++;
          var id = "infographic" + j;
          var legend_id = "legend" + j;
          var chartRoot = $("#" + id);
          var title = field.name;

          if(field.type === "esriFieldTypeString"){
            // code for chart.js
            var dataset = [];
            var labels = [];
            var data = this.values.filter(function(set){
              return set["title"] === field.name;
            })[0]["data"];
            
            labels = Object.keys(data);
            labels.sort();
            for(i = 0; i < labels.length; i++){
              var label = labels[i];
              dataset.push(data[label]);
            }

            var colors = palette('tol-rainbow', dataset.length).map(function(hex) {
              return '#' + hex;
            });
            var chart_data = {
              datasets: [{
                data: dataset,
                backgroundColor: colors
              }],
              labels: labels
            };

            var doughnut = new Chart(chartRoot, {
              type: "doughnut",
              data: chart_data,
              options: {
                title: {
                  display: true,
                  fontSize: 20,
                  fontColor: "#333",
                  text: field.alias
                },
                legend: {
                  position: "bottom"
                }
              }
            });


            this.charts.push(doughnut);

            // code for dojo charts
            // var series = [];
            // var data = values.filter(function(set){
            //   return set["title"] === field.name;
            // })[0]["data"];

            // for(i in data){
            //   var item = {
            //     y: data[i],
            //     text: i
            //   }
            //   series.push(item);
            // }

            // series.sort(function(a, b){
            //   return a.text.localeCompare(b.text);
            // });

            // if(this.charts[j - 1]){
            //   var chart = this.charts[j - 1];
            //   chart.updateSeries(title, series);
            // }
            // else{
            //   var chart = new Chart(id, {
            //     title: title
            //   });
            //   chart.setTheme(Harmony)
            //     .addPlot("default", {
            //       type: Pie,
            //       labelStyle: "outside",
            //       font: "normal normal 11pt Arial"
            //     });
            //     this.charts.push(chart);
            //     chart.addSeries(title, series);
            // }
            // var move = new MoveSlice(chart, "default", {
            //   shift: 5
            // });
            // var tooltip = new Tooltip(chart, "default", {
            //   text: function(o){
            //     return o.y;
            //   }
            // });
            // chart.render();

            // if(this.legends[j - 1]){
            //   var legend = this.legends[j - 1];
            //   legend.refresh();
            // }
            // else{
            //   var legend = new Legend({chart: chart}, legend_id);
            //   this.legends.push(legend);
            // }
            
          }
        }));
      },

      // for removing chart.js graphs
      _clearGraphs: function(){
        this.charts.forEach(function(chart){
          chart.destroy();
        });
      }


    });

    return clazz;
});
