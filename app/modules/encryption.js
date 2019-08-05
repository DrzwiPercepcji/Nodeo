const fs = require('fs');
const crypto = require('crypto');

const DIRECTION_INCREASE = 1;
const DIRECTION_DECREASE = -1;

function calculateByte(byte, direction) {
    let result = byte;

    while (result % 32 !== 0) {
        result += direction;
    }

    return result;
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

exports.decryptFile = function (path, key, start, end, response) {
    let realEnd = calculateByte(end, DIRECTION_INCREASE) - 1;
    let decipher = crypto.createDecipheriv('aes-128-ecb', key, '');

    const reader = fs.createReadStream(path + '.aes', { start, realEnd });

    reader.pipe(decipher).pipe(response);
}