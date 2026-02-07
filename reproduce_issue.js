
const files = [
    { name: 'test.html' },
    { name: 'test.htm' },
    { name: 'TEST.HTML' },
    { name: 'archive.html.bak' } // Edge case
];

console.log('--- HTML Export Names ---');
files.forEach(f => {
    const downloadName = `utf8_${f.name}`;
    console.log(`Original: ${f.name} -> Download: ${downloadName}`);
});

console.log('\n--- PDF Export Names (Current Logic) ---');
files.forEach(f => {
    // Current logic in src/App.jsx line 105
    const filename = `${f.name.replace('.html', '')}.pdf`;
    console.log(`Original: ${f.name} -> PDF: ${filename}`);
});

console.log('\n--- PDF Export Names (Implemented Logic) ---');
files.forEach(f => {
    // Implemented logic in src/App.jsx
    const filename = `${f.name.substring(0, f.name.lastIndexOf('.')) || f.name}.pdf`;
    console.log(`Original: ${f.name} -> PDF: ${filename}`);
});
