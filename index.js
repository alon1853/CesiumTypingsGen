const fs = require('fs');
const request = require('request');
const cheerio = require('cheerio');

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
                numberOfClasess++;
                LoadClassData(name);
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
        console.log('Building class ' + name + '..');

        const $ = cheerio.load(body);
        let classContent = '';

        classContent += '\n\tclass ' + name + ' {\n';
        classContent += ExtractClassDataMembers($);
        classContent += ExtractClassConstructor($);
        classContent += ExtractClassMethods($);
        classContent += ExtractTypeDefinitions($);    
        classContent += '\t}\n';

        classesMap.set(name, classContent);

        if (classesMap.size === numberOfClasess) {
            const clasessContent = PrepareClasses();
            WriteToFile(clasessContent);
        }
    });
}

function ExtractParamsFromTable($, table) {
    let result = '';
    let hasOptionsElement = false;

    const params = $(table).find('tbody tr');
    params.each((i, element) => {
        const name = $(element).find('.name').first().text();
        const type = $(element).find('.type').text().trim().replace(/(\r\n\t|\n|\r\t)/gm, "");
        const description = $(element).find('.description');

        if (name === '' || type === '') {
            return;
        }

        const optional = ExtractOptional($, description);

        if (name === 'options') {
            result += name + optional + ': { ';
            hasOptionsElement = true;
        } else {
            const param = { name: name, type: CleanType(type) };

            result += param.name + optional + ': ' + param.type;

            if (i !== (params.length - 1)) {
                result += ', ';
            }
        }
    });

    if (hasOptionsElement) {
        result += ' }';
    }

    return result;
}

function ExtractClassConstructor($) {
    const table = $('dd').eq(0).find('table.params');
    const params = ExtractParamsFromTable($, table);
    const constructorString = '\n\t\tconstructor(' + params + ');\n\n';

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
                    const returnType = CleanType($(element).find('.returnType').text());
        
                    methodName += ': ' + ((returnType !== '') ? returnType : 'void');
                    result += '\t\t' + methodName + ';\n';
                }
            });
        }
    });

    return result;
}

function ExtractTypeDefinitions($) {
    let result = '';

    return result;
}

function CleanType(type) {
    let result = type;
    result = result.replace(/\./g, '').replace(/\~/g, '.').replace(/\|/g, ' | ').replace(/ \: /g, ': ');
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