/**
*	
*
*/
'use strict';
var app = angular.module('app', []);

app.controller('MainCtrl', function($scope, $filter) {
	$scope.filter = $filter;
	$scope.fieldTypes = [{type: 'value'},{type: 'iterator'}];
	$scope.iteratorTypes = [{type: 'numeric'},{type: 'date'},{type: 'array'}];
	$scope.dateStepTypes = [{type: 'year'},{type: 'month'},{type: 'day'}];
	
	// dummy values to start with
	$scope.model = {};
	$scope.model.tableName = 'my_table';
	$scope.model.fields = [
		{name: 'first_name', type: 'value', value: "'john'"},
		{name: 'last_name', type: 'value', value: "'doe'"},
		{name: 'year_field', type: 'iterator', iterator: { type: 'numeric', from: 2010, to: 2013 }},
		{name: 'date_field', type: 'iterator', iterator: { type: 'date', from: '1/1/2010', to: '1/1/2013', dateStepType: 'year', dateStep: 1, }},
		{name: 'level', type: 'iterator', iterator: { type: 'array', arrayValues: "'level a', 'level b', 'level c'" }},
	];
	
	// function to add a new field
	$scope.addField = function() {
		$scope.model.fields.push({
			name: '',
			type: 'value',
			value: '',
		});
	};
	
	// function to remove a field
	$scope.removeField = function(field) {
		$scope.model.fields.splice($scope.model.fields.indexOf(field),1);
	};
	
	// removes all fields, adds one blank one
	$scope.resetFields = function() {
		$scope.model.fields = [];
		$scope.addField();
	}
	
	// function executed when a field iterator type is changed by the user
	$scope.iteratorTypeChanged = function(field) {
		// reset fields
		field.iterator.from = undefined;
		field.iterator.to = undefined;
		field.iterator.dateStepType = undefined;
		field.iterator.dateStep = undefined;
		field.iterator.arrayValues = undefined;
	}
	
	$scope.tieToListFilter = function(currentField) {
		(function(currentField){
			return function(filteredField, currentField) {
				if (filteredField.type == 'iterator') return true;
				return false;
			}
		})(currentField);
	}
	
	// function to generate the sql from the fields
	$scope.model.generatedSql = '';
	$scope.generateSql = function() {
		var sql = '';
		var fieldNames = '';
		var iteratorFields = [];
		var iteratorMap = {};
		// preprocess some things
		for (var i = 0; i < $scope.model.fields.length; i++) {
			var field = $scope.model.fields[i];
			// make a comma separated string of all field names
			fieldNames += field.name;
			if (i < ($scope.model.fields.length - 1)) fieldNames += ', ';
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
				// date iterator
				else if (field.iterator.type == 'date') {
					var from = new Date(field.iterator.from);
					var to = new Date(field.iterator.to);
					var stepType = field.iterator.dateStepType;
					var step = parseInt(field.iterator.dateStep);
					if (!stepType || isNaN(from.getTime()) || isNaN(to.getTime()) || isNaN(step)) {
						alert('Date type iterator value is invalid');
						return;
					}
					field.iterator.values = [];
					while (from <= to) {
						field.iterator.values.push("'" + $filter('date')(from, 'yyyy-MM-dd') + "'");
						if (stepType == 'year') {
							from.setFullYear(from.getFullYear() + step);
						}
						else if (stepType == 'month') {
							from.setMonth(from.getMonth() + step);
						}
						else if (stepType == 'day') {
							from.setDate(from.getDate() + step);
						}
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
				// iterator map for quick access to iterators by field name
				iteratorMap[field.name] = field;
				// create an array in the iterator field for other iterators to be tied to
				field.tiedIterators = {};
			}
		}
		
		// run through iterators and attach tieTo iterators
		for (var i = 0; i < iteratorFields.length; i++) {
			var iteratorField = iteratorFields[i];
			if (iteratorField.iterator.tieTo && iteratorField.iterator.tieTo.name.toLowerCase() != 'none') {
				iteratorMap[iteratorField.iterator.tieTo.name].tiedIterators[iteratorField.name] = iteratorField;
				iteratorFields.splice(i,1);
				i--;
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
					// if there are iterators tied to this iterator, get their values too
					for (var iteratorFieldName in iteratorField.tiedIterators) {
						var tiedIterator = iteratorField.tiedIterators[iteratorFieldName];
						if (j < tiedIterator.iterator.values.length) {
							tmp[tiedIterator.name] = tiedIterator.iterator.values[j];
						} else {
							tmp[tiedIterator.name] = 'null';
						}
					}
					// recursive call
					out += processIteratorField(iteratorFieldIndex + 1, angular.extend(tmp, iteratorsValues));
				}
				// last iterator field
				else {
					out += 'INSERT INTO ' + $scope.model.tableName + ' (' + fieldNames + ') VALUES(';
					// for all fields
					for (var k = 0; k < $scope.model.fields.length; k++) {
						var field = $scope.model.fields[k];
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
						// if the field is an iterator that's tied to this iterator
						else if (field.type == 'iterator' && field.name in iteratorField.tiedIterators) {
							if (j < iteratorField.tiedIterators[field.name].iterator.values.length) {
								out += trim(iteratorField.tiedIterators[field.name].iterator.values[j]);
							}
							else {
								out += 'null';
							}
						}
						// if not last field, add comma after field value
						if (k < ($scope.model.fields.length -1)) {
							out += ', ';
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

		$scope.model.generatedSql = out;
	}
});

// prepends an element to an array
app.filter('prependToArray', function() {
	// push el to arr
	return function(arr, el) {
		return [el].concat(arr);
	}
});