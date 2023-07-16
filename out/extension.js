"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
function convertToUsageText(input) {
    if (input.startsWith('.')) {
        return toCamelCase(input.slice(1));
    }
    if (input.startsWith('--')) {
        return '$' + toCamelCase(input.slice(2));
    }
    return toCamelCase(input);
}
function toCamelCase(input) {
    return input
        .split(/[-_\s]/)
        .map((word, index) => (index === 0 ? word : word[0].toUpperCase() + word.slice(1)))
        .join('');
}
function formatStyledWindDocument(document) {
    let edits = [];
    let text = document.getText();
    // if no have string
    if (!text.length) {
        text = `import { styled } from '@styledwind/styled'; export default styled<>\`

  @scope: your-scope;

\`;
// Happy Styling;
	`;
    }
    const regex = /(?<=@join[^@]*?)\$[a-zA-Z0-9_-]+|\.[\w-]+|--[\w-]+/g;
    const matches = Array.from(text.matchAll(regex)).map((match) => match[0]);
    // Remove duplicates
    const uniqueMatches = Array.from(new Set(matches));
    // Sort the array, considering $ character
    const uniqueAndSortedMatches = uniqueMatches.sort((a, b) => {
        if (a.startsWith('$') && !b.startsWith('$')) {
            return -1;
        }
        else if (!a.startsWith('$') && b.startsWith('$')) {
            return 1;
        }
        else {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        }
    });
    // Convert the sorted array into a string
    const newStyledContent = uniqueAndSortedMatches
        .map((match) => `'${convertToUsageText(match)}'`)
        .sort(function (a, b) {
        if (a.startsWith('$') && !b.startsWith('$')) {
            return -1; // "a" comes first
        }
        else if (!a.startsWith('$') && b.startsWith('$')) {
            return 1; // "b" comes first
        }
        else {
            // If neither or both start with "$", sort normally
            if (a < b) {
                return -1;
            }
            else if (a > b) {
                return 1;
            }
            else {
                return 0;
            }
        }
    })
        .join(' | ');
    if (text.includes('styled<>')) {
        text = text.replace('styled<>', `styled<''>`);
    }
    text = text.replace(/(?<=styled<).+?(?=>)/, newStyledContent);
    // Move 'export default styled<...>' to the same line as the import statement
    text = text.replace(/(import { styled } from '@styledwind\/styled';)\s+(export default styled<.*?>)/, '$1 $2');
    // Normalize indentation and newlines
    let lines = text.split(/\r?\n/);
    // Remove empty lines
    lines = lines.filter((line) => line.trim() !== '');
    text = lines
        .map((line, index) => {
        // Remove leading and trailing white space
        line = line.trim();
        // Normalize indentation based on leading keywords
        if (line.startsWith('@')) {
            line = '  ' + line;
            // Add extra newline before each new section, but not for the first one
            if (index > 0) {
                line = '\n' + line;
            }
        }
        else if (line.startsWith('$') || line.startsWith('--') || line.startsWith('.')) {
            line = '    ' + line;
        }
        else if (line.match(/^\s*(\d+%)/)) {
            line = '      ' + line;
        }
        return line;
    })
        .join('\n');
    /* ex: 50%,60% => 50%, 60% */
    text = text.replace(/,/g, ', ');
    /* ex:  bg[primary-200  ] => bg[primary-200]*/
    text = text.replace(/\s+]/g, ']');
    /* ex:  bg[  primary-200] => bg[primary-200]*/
    text = text.replace(/\[\s+/g, '[');
    text = text.replace(/\[\s+/g, '[');
    // ex: bg[red]    ; => bg[red];
    text = text.replace(/\s+;/g, ';');
    text = text.replace(/(?<=[^:;\s]+\s*$)/gm, ';');
    text = text.replace(/^\s*;\s*$|(?<=>\`);/gm, '');
    text = text.replace(/(?<=,\s*)\s+/g, ' ');
    text = text.replace(/(?<=\S) +(?=\S)/g, ' ');
    // ex: .test    : bg[red] => ex: .test: bg[red]
    text = text.replace(/\s+:[\w\d\s+\[\]-]+;/g, function (match) {
        return match.replace(/\s+/g, ' ').trim();
    });
    // ex: .test:bg[red] => .test: bg[red]
    text = text.replace(/:[\w\d]+[\[\]]|:--|:\$/g, function (match) {
        return match.replace(/:/g, ': ').trim();
    });
    // ex: bg[red]tx[white] => bg[red] tx[white]
    text = text.replace(/](\w|--|\$)/g, function (match) {
        return match.replace(/]/g, '] ').trim();
    });
    const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
    edits.push(vscode.TextEdit.replace(fullRange, text));
    return edits;
}
function activate(context) {
    const languageConfig = {
        language: 'styledwind',
        scheme: 'file',
        pattern: '**/*.sw.ts',
    };
    const disposable = vscode.languages.registerCompletionItemProvider(languageConfig, {
        provideCompletionItems(document, position) {
            return [];
        },
    });
    const disposable2 = vscode.languages.registerDocumentFormattingEditProvider(languageConfig, {
        provideDocumentFormattingEdits(document) {
            return formatStyledWindDocument(document);
        },
    });
    const tabInsideBracketEvent = vscode.commands.registerCommand('extension.jumpToNextBracket', function () {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const document = editor.document;
            const selection = editor.selection;
            const textAfterCursor = document.getText(new vscode.Range(selection.end, document.positionAt(document.getText().length)));
            const textBeforeCursor = document.getText(new vscode.Range(document.positionAt(0), selection.start));
            const nextClosingBracketIndex = textAfterCursor.indexOf(']');
            const nextOpeningBracketIndex = textAfterCursor.indexOf('[');
            // Checks if cursor is inside []
            if (nextClosingBracketIndex !== -1 &&
                (nextOpeningBracketIndex === -1 || nextOpeningBracketIndex > nextClosingBracketIndex) &&
                textBeforeCursor.lastIndexOf('[') > textBeforeCursor.lastIndexOf(']')) {
                const targetPos = selection.end.translate(0, nextClosingBracketIndex + 1);
                editor.selection = new vscode.Selection(targetPos, targetPos);
            }
            else {
                vscode.commands.executeCommand('tab');
            }
        }
    });
    context.subscriptions.push(disposable, disposable2, tabInsideBracketEvent);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map