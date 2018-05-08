const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');

const INTERFACE = 'interface';
const CLASS = 'class';
const CESIUM_DOCUMENTATION_URL = 'https://cesiumjs.org/Cesium/Build/Documentation/';
const classesMap = new Map();
let numberOfClasess = 0;

Generate();

function Generate() {

    console.log('Loading classes names..');
    HttpRequest(CESIUM_DOCUMENTATION_URL, (body) => {
        const $ = cheerio.load(body);

        console.log('Starting to build classes:');
        console.log('---------------------------------------------------------------------');
        const classesNames = GetClassesNames($);
        classesNames.forEach((name) => {
            if (name[0] === name[0].toUpperCase()) {
            // if (name === 'HeightmapTerrainData') {
                numberOfClasess++;
                LoadClassData(name);
            } else {
                LoadStaticFunctionData(name);
            }
        });
    });
}

function HttpRequest(url, callback) {
    request(url, (err, res, body) => {
        if (err) {
            console.log(err);

            return;
        }

        callback(body);
    });
}

function GetClassesNames($) {
    const classesNames = [];

    $('#ClassList li').each((i, element) => {
        classesNames.push($(element).text());
    });

    return classesNames;
}

function LoadClassData(name) {
    HttpRequest(CESIUM_DOCUMENTATION_URL + name + '.html', (body) => {
        const $ = cheerio.load(body);
        let classContent = '';
        let typeDefinitions = '';
        const prototype = GetClassOrInterfaceTitle($);

        console.log('Building ' + prototype + ' ' + name + '..');

        classContent += '\n\t' + prototype + ' ' + name + ' {\n';
        classContent += ExtractClassDataMembers($);
        if (prototype !== INTERFACE) {
            classContent += ExtractClassConstructor($);
        }
        classContent += ExtractClassMethods($);
        classContent += '\t}\n';

        typeDefinitions = ExtractTypeDefinitions($, name);

        classesMap.set(name, classContent + typeDefinitions);

        if (classesMap.size === numberOfClasess) {
            const clasessContent = PrepareClasses();
            WriteToFile(clasessContent);
        }
    });
}

function LoadStaticFunctionData(name) {

}

function ExtractParamsFromTable($, table) {
    let result = '';
    const optionsSonsArray = new Array();

    const tbody = $(table).find('tbody');
    $(tbody).find('tr').each((i, element) => {
        const name = $(element).find('.name').first().text();
        const type = $(element).find('.type').first().text().replace(/\s/g, '');
        const description = $(element).find('.description');

        if (name === '' || type === '') {
            return;
        }

        const optional = ExtractOptional($, description);

        if ($(description).find('table.params').length > 0) {
            result += name + optional + ': { ';

            currentChildren = $(description).find('tbody').first().children().length;

            if (optionsSonsArray.length > 0) {
                optionsSonsArray[optionsSonsArray.length - 1]--;
            }
            optionsSonsArray.push(currentChildren);
        } else {
            const param = { name: name, type: CleanType(type) };

            result += param.name + optional + ': ' + param.type;
            
            if (optionsSonsArray.length > 0) {
                optionsSonsArray[optionsSonsArray.length - 1]--;

                if (optionsSonsArray[optionsSonsArray.length - 1] === 0) {
                    result += ' }, ';
                    optionsSonsArray.splice(optionsSonsArray.length - 1, 1);
                } else {
                    result += ', ';
                }
            } else {
                result += ', ';
            }
        }
    });

    // result = result.replace('{  }', 'any');
    
    return result;
}

function ExtractClassConstructor($) {
    const table = $('dd').eq(0).find('table.params');
    const params = ExtractParamsFromTable($, table);
    let constructorString = '\n\t\tconstructor(' + params + ');\n\n';
    constructorString = constructorString.replace(', )', ')');

    return constructorString;
}

function ExtractClassDataMembers($) {
    let result = '';

    const h3 = $('h3');
    $('h3').each((i, h3Element) => {
        if ($(h3Element).text() === 'Members') {
            $(h3Element).next('dl').find('dt').find('h4.name').each((i, element) => {
                let memberName = $(element).attr('id').replace('.', '');
                const memberType = CleanType($(element).find('.type-signature').last().text());

                const attributes = ExtractAttributes($, element);
                memberName = attributes + memberName;
                result += '\t\t' + memberName;
                result += memberType + ';\n';
            });
        }
    });

    return result;
}

function ExtractClassMethods($) {
    let result = '';

    $('h3').each((i, h3Element) => {
        if ($(h3Element).text() === 'Methods') {
            $(h3Element).next('dl').find('dt').each((i, dt) => {
                const element = $(dt).find('h4.name');
                const table = $(dt).parent().find('dd').eq(i).find('table.params');
                const methodParams = ExtractParamsFromTable($, table);
                const id = $(element).attr('id');

                if (id) {
                    const attributes = ExtractAttributes($, element);
                    let methodName = attributes + id.replace('.', '') + '(' + methodParams + ')';
                    methodName = methodName.replace(', )', ')');
                    const returnType = CleanType($(element).find('.returnType').text());

                    methodName += ': ' + ((returnType !== '') ? returnType : 'void');
                    result += '\t\t' + methodName + ';\n';
                }
            });
        }
    });

    return result;
}

function ExtractTypeDefinitions($, name) {
    let result = '';

    $('h3').each((i, h3Element) => {
        if ($(h3Element).text() === 'Type Definitions') {
            $(h3Element).next('dl').find('dt').each((i, dt) => {
                const element = $(dt).find('h4.name');
                const table = $(dt).parent().find('dd').eq(i).find('table.params');
                const methodParams = ExtractParamsFromTable($, table);
                const id = $(element).attr('id');

                if (id) {
                    const attributes = ExtractAttributes($, element);
                    let methodName = attributes + id.replace('.', '').replace('~', '');
                    let returnType = CleanType($(element).find('.returnType').text());
                    returnType = ((returnType !== '') ? returnType : 'void');

                    result += '\t\t' + 'type ' + methodName + ' = (' + methodParams + ') => ' + returnType + ';\n';
                }
            });
        }
    });

    if (result !== '') {
        result = '\n\tmodule ' + name + ' {\n' + result;
        result += '\t}\n';
    }

    return result;
}

function GetClassOrInterfaceTitle($) {
    const description = $('dd').eq(0).find('.description').text();

    if (description.includes(INTERFACE)) {
        return INTERFACE;
    }

    return CLASS;
}

function CleanType(type) {
    let result = type;
    result = result.replace(/\./g, '').replace(/\~/g, '.').replace(/\|/g, ' | ').replace(/ \: /g, ': ').replace(/\*/g, 'any');
    // result = result.replace(' | undefined', '');
    result = result.replace('Canvas', 'HTMLCanvasElement');
    result = result.replace(new RegExp('\\bImage\\b'), 'HTMLImageElement');
    result = result.replace('Boolean', 'boolean');
    result = result.replace('String', 'string');
    result = result.replace('Number', 'number');
    result = result.replace('Object', 'any');

    if (result === ': Array') {
        result += '<any>';
    }

    return result;
}

function ExtractAttributes($, element) {
    const readOnly = $(element).find('.attribute-readonly').text();
    const static = $(element).find('.attribute-static').text();
    const constant = $(element).find('.attribute-constant').text();

   let result = '';

    if (readOnly !== '') {
        result += readOnly + ' '
    }

    if (static !== '') {
        result += static + ' ';
    }

    if (constant !== '') {
        result += 'readonly ';
    }

    return result;
}

function ExtractOptional($, element) {
    const optional = $(element).find('.optional').first().text();

    let result = '';

    if (optional !== '') {
        result = '?';
    }

    return result;
}

function PrepareClasses() {
    let fileContent = '';

    classesMap.forEach((value, key) => {
        fileContent += value;
    });

    return fileContent;
}

function WriteToFile(content) {
    tmpContent = 'declare module Cesium {\n';
    tmpContent += content;
    tmpContent += '\n}\n\ndeclare module \'cesium\' {\n\texport = Cesium;\n}';
    
    fs.writeFile("index.d.ts", tmpContent, (err) => {
        if (err) {
            return console.log(err);
        }
        
        console.log('---------------------------------------------------------------------');
        console.log("The file created successfully!");
    });
}