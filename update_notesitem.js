const fs = require('fs');

// Read the file
const filePath = 'client/src/components/NoteTreeItem.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Update imports - remove color-related imports
content = content.replace(/import ColorPicker.*from "\.\/ColorPicker";/, '');
content = content.replace(/import \{ .*convertLegacyColorToValue.* \} from "@\/lib\/color-utils";/, '// Color picker related imports removed');

// Remove editColor and setEditColor state hooks
content = content.replace(/const \[editColor, setEditColor\] = useState<number \| null>\([^)]*\);/, '// Color state removed as requested');

// Remove ColorPicker components
content = content.replace(/<ColorPicker[\s\S]*?\/>/g, '// ColorPicker component removed');

// Remove style={getNoteBackgroundStyle(...)}
content = content.replace(/style=\{getNoteBackgroundStyle\([^}]*\)\}/g, '// Background styling removed');

// Remove color from the updatedNote
content = content.replace(/color: editColor/, '// color property removed');

// Remove setEditColor calls
content = content.replace(/setEditColor\([^)]*\);/g, '// setEditColor calls removed');

// Remove UI elements related to color
content = content.replace(/{\/\* Color settings \*\/}[\s\S]*?{\/\* Time settings \*\/}/g, '{/* Color settings removed */}\n                  {/* Time settings */}');

// Write the file back
fs.writeFileSync(filePath, content);
console.log('Color picker functionality removed from NoteTreeItem.tsx');
