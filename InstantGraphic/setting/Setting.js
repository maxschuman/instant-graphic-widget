define([
  'dojo/_base/declare',
  'jimu/BaseWidgetSetting',
  'dojo/_base/lang',
  'dojo/_base/array',
  'dijit/_WidgetsInTemplateMixin',
  'dijit/form/Select',
  'jimu/LayerInfos/LayerInfos',
  'jimu/loaderplugins/jquery-loader!https://cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js'
],
function(declare, BaseWidgetSetting, lang, array, _WidgetsInTemplateMixin, Select, LayerInfos) {
	var clazz = declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
		baseClass: "jimu-widget-instantsummarize-setting",

		startup: function(){
			this.inherited(arguments);
			if (!this.config) {
	          this.config = {};
	        }
	        this.setConfig(this.config);
		},

		setConfig: function(config){
			this.countLabelNode.value = config.countLabel;
			// Get all feature layers from map
			var layerInfosObject = LayerInfos.getInstanceSync();
			var infos = layerInfosObject.getLayerInfoArray();
			var boundaryOptions = [];
			var pointsOptions = [];
			array.forEach(infos, function(info) {
			  if(info.originOperLayer.layerType === 'ArcGISFeatureLayer' && info.originOperLayer.resourceInfo.geometryType === 'esriGeometryPolygon') {
			    boundaryOptions.push({
			      label: info.title,
			      value: info.id
			    });
			  }
			  else if (info.originOperLayer.layerType === 'ArcGISFeatureLayer' && info.originOperLayer.resourceInfo.geometryType === 'esriGeometryPoint'){
			  	pointsOptions.push({
			      label: info.title,
			      value: info.id
			    });
			  }
			});

			this.boundarySelect.set('options', boundaryOptions);
			this.pointsSelect.set('options', pointsOptions);

			this.pointsSelect.on('change', lang.hitch(this, function(value){
				var selectedLayer = layerInfosObject.getLayerInfoById(value);
				this.attributesList.innerHTML = "";
				this.fieldConfig = [];
				if(selectedLayer){
					var fields = selectedLayer.layerObject.fields;
					array.forEach(fields, lang.hitch(this, function(field){
						var rowText = "<tr class='field'>";
						rowText += "<td>" + field.alias + "</td>";
						rowText += "<td>" + field.type.substring(13) + "</td>";
						if(field.type == "esriFieldTypeString"){
							rowText += '<td><input type="checkbox"></td>'
						}
						else{
							rowText += "<td></td>"
						}
						rowText += "</tr>";
						this.attributesList.innerHTML += rowText;

						var fieldInfo = {
							"name": field.name,
							"alias": field.alias,
							"type": field.type,
							"selected": false
						}
						this.fieldConfig.push(fieldInfo);
					}));

					$("input").click(lang.hitch(this, function(evt){
						var entry = $(evt.target).parents("td");
						var alias = entry.siblings()[0].innerHTML;

						array.forEach(this.fieldConfig, function(field){
							if(field.alias === alias){
								field.selected = !field.selected;
							}
						});
					}));
				}
			}));
		},

		getConfig: function(){
			return {
				"pointsLayerID": this.pointsSelect.value,
				"boundaryLayerID": this.boundarySelect.value,
				"fields": this.fieldConfig,
				"graphicColors": ["#E50000", "#0043FF", "#E5C000", "#00BF48", "#6000BF", "#FF6200", "#401800", "#000", "#333"],
				"zoomLevel": 12,
				"showCount": this.countCheck.checked,
				"countLabel": this.countLabelNode.value,
				"editableBoundaries": this.editableCheck.checked
			}
		}
	});

	return clazz;
});