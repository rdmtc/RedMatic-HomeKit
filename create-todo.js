const fs = require('fs');

const dir = fs.readdirSync('./homematic-devices');

dir.forEach(file => {
    if (file.match(/h.*-.*\.js/)) {
        const len = fs.readFileSync('./homematic-devices/' + file).toString().split('\n').length;
        if (len > 4) {
            console.log('- [ ] ' + file.replace('.js', ''));
        }
    }
});
