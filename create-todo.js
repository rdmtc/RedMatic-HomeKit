const fs = require('fs');

const dir = fs.readdirSync('./homematic-devices');

for (const file of dir) {
    if (/h.*-.*\.js/.test(file)) {
        const {length} = fs.readFileSync('./homematic-devices/' + file).toString().split('\n');
        if (length > 4) {
            console.log('- [ ] ' + file.replace('.js', ''));
        }
    }
}
