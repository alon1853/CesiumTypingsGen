const fs = require('fs');
const request = require('sync-request');
const cheerio = require('cheerio');

Generate();

function Generate() {
    console.log('Loading classes names..');
    const body = HttpRequest('https://cesiumjs.org/Cesium/Build/Documentation/');
    let fileContent = '';
    const $ = cheerio.load(body.toString());

    console.log('Starting to build classes:\n')
    const classesNames = GetClassesNames($);
    classesNames.forEach((name) => {
        if (name[0].toUpperCase() === name[0] && (name[0] === 'A' || name[0] === 'B')) {
            fileContent += '\n\tclass ' + name + ' {\n';

            const classData = LoadClassData(name);
            fileContent += classData;

            fileContent += '\t}\n';
        }
    });

    WriteToFile(fileContent);
}

function HttpRequest(url) {
    const result = request('GET', url);

    return result.getBody();
}

function GetClassesNames($) {
    const classesNames = [];

    $('#ClassList li').each((i, element) => {
        classesNames.push($(element).text());
    });

    return classesNames;
}

function LoadClassData(name) {
    console.log('Building class ' + name + '..');

    const body = HttpRequest('https://cesiumjs.org/Cesium/Build/Documentation/' + name + '.html');
    const $ = cheerio.load(body.toString());
    
    let result = '';
    result += ExtractClassDataMembers($);
    result += ExtractClassConstructor($);
    result += ExtractClassMethods($);
    result += ExtractTypeDefinitions($);

    return result;
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
                let methodName = $(element).attr('id').replace('.', '') + '(' + methodParams + ')';
                const returnType = CleanType($(element).find('.returnType').text());
    
                methodName += ': ' + ((returnType !== '') ? returnType : 'void');
    
                result += '\t\t' + methodName + ';\n';
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
    result = result.replace(' | undefined', '');
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

function WriteToFile(content) {
    tmpContent = 'declare module Cesium {\n';
    tmpContent += content;
    tmpContent += '\n}\n\ndeclare module \'cesium\' {\n\texport = Cesium;\n}';

    fs.writeFile("index.d.ts", tmpContent, (err) => {
        if (err) {
            return console.log(err);
        }

        console.log("\nThe file was saved!");
    });
}