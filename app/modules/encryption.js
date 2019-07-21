const fs = require('fs');
const crypto = require('crypto');

function calculateRealStart() {
}

function calculateRealEnd() {
}

exports.encryptFile = function (filePath, key) {
    console.log(`Encrypting file: ${filePath}.`);

    let cipher = crypto.createCipheriv('aes-128-ecb', key, '');
    let input = fs.createReadStream(filePath);
    let output = fs.createWriteStream(filePath + '.aes');

    input.pipe(cipher).pipe(output);

    output.on('finish', function () {
        console.log('Encrypted file written to disk!');
    });
}

exports.decryptFile = function (filePath, key, start, end) {
    
}