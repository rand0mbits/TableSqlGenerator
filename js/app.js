/**
*	
*
*/
'use strict';
var app = angular.module('app', []);

app.controller('MainCtrl', function($scope) {
	$scope.fieldTypes = [{type: 'value'},{type: 'iterator'}];
	$scope.iteratorTypes = [{type: 'numeric'},{type: 'array'}];
	
	// dummy values to start with
	$scope.tableName = 'my_table';
	$scope.fields = [
		{name: 'year_field', type: 'iterator', iterator: { type: 'numeric', from: 2010, to: 2015 }},
		{name: 'first_name', type: 'value', value: "'john'"},
		{name: 'last_name', type: 'value', value: "'doe'"},
		{name: 'level', type: 'iterator', iterator: { type: 'array', arrayValues: "'level a', 'level b', 'level c'" }},
	];
	
	// function to add a new field
	$scope.addField = function() {
		$scope.fields.push({
			name: '',
			type: 'value',
			value: '',
		});
	};
	
	// function to remove a field
	$scope.removeField = function(field) {
		$scope.fields.splice($scope.fields.indexOf(field),1);
	};
	
	// removes all fields, adds one blank one
	$scope.resetFields = function() {
		$scope.fields = [];
		$scope.addField();
	}
	
	// function to generate the sql from the fields
	$scope.generatedSql = '';
	$scope.generateSql = function() {
		var sql = '';
		var fieldNames = '';
		var iteratorFields = [];
		// preprocess some things
		for (var i = 0; i < $scope.fields.length; i++) {
			var field = $scope.fields[i];
			// make a comma separated string of all field names
			fieldNames += field.name;
			if (i < ($scope.fields.length - 1)) fieldNames += ', ';
			// if field is an iterator, create a "values" array in it containing all values to iterate over
			if (field.type == 'iterator') {
				// numeric iterator
				if (field.iterator.type == 'numeric') {
					field.iterator.values = [];
					var from = parseInt(field.iterator.from);
					var to = parseInt(field.iterator.to);
					if (isNaN(from) || isNaN(to)) {
						alert('Numeric iterator contains invalid values');
						return;
					}
					for (var j = from; j <= to; j++) {
						field.iterator.values.push(j);
					}
				}
				// array/list iterator
				else if (field.iterator.type == 'array') {
					if (!field.iterator.arrayValues) {
						alert('Array type iterator value is invalid');
						return;
					}
					field.iterator.values = field.iterator.arrayValues.split(',');
				}
				// create and populate an array of all iterator fields. this step is key to later processing
				iteratorFields.push(field);
			}

		}
		
		function processIteratorField(iteratorFieldIndex, iteratorsValues) {
			var iteratorField = iteratorFields[iteratorFieldIndex];
			var out = '';
			// function to trim strings and return other objects unchanged
			function trim(obj) {
				if (typeof obj === "string") return obj.trim();
				else return obj;
			}
			for (var j = 0; j < iteratorField.iterator.values.length; j++) {
				// before last iterator field
				if (iteratorFieldIndex < (iteratorFields.length - 1)) {
					// create a temp object with the name of the field and its value in the current iteration
					var tmp = {};
					tmp[iteratorField.name] = iteratorField.iterator.values[j];
					// recursive call
					out += processIteratorField(iteratorFieldIndex + 1, angular.extend(tmp, iteratorsValues));
				}
				// last iterator field
				else {
					out += 'INSERT INTO ' + $scope.tableName + ' (' + fieldNames + ') VALUES(';
					// for all fields
					for (var k = 0; k < $scope.fields.length; k++) {
						var field = $scope.fields[k];
						// if the field is a regular value, not an iterator, just use that value
						if (field.type == 'value') {
							out += trim(field.value);
						}
						// if the field is the current field being processed by processIteratorField()
						// use the value of the current iteration of the loop
						else if (field.type == 'iterator' && field.name == iteratorField.name) {
							out += trim(iteratorField.iterator.values[j]);
						}
						// if the field is an iterator field other than the one being currently processed by processIteratorField()
						// get its value from passed in map of iteratorsValues
						else if (field.type == 'iterator' && field.name in iteratorsValues) {
							out += trim(iteratorsValues[field.name]);
						}
						// if not last field, add comma after field value
						if (k < ($scope.fields.length -1)) {
							out += ',';
						}
					}
					out += ');\r\n';
				}
			}
			return out;
		}
		var out = '';
		// this is where the main processing is started up, calling processIteratorField() on the first iterator field
		if (iteratorFields.length > 0) {
			out = processIteratorField(0, []);
		}

		$scope.generatedSql = out;
	}
});