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
    console.log('Requested bytes from: ' + start + ' to: ' + end);

    //let realStart = calculateByte(start, DIRECTION_DECREASE);
    //let realEnd = calculateByte(end, DIRECTION_INCREASE) - 1;

    let decipher = crypto.createDecipheriv('aes-128-ecb', key, '');

    const reader = fs.createReadStream(path + '.aes');

    reader.pipe(decipher).pipe(response);

    /*
    let encrypted;
    
    reader.on('data', function (chunk) {
        encrypted += chunk;
    });

    reader.on('end', function () {
        console.log('Finished reading bytes from: ' + realStart + ' to: ' + realEnd);

        let decrypted = decipher.update(encrypted, 'binary', 'utf8');

        let sliceStart = start - realStart;
        let sliceEnd = end - start + sliceStart;

        decrypted.slice(sliceStart, sliceEnd);

        console.log('Sliced bytes from: ' + sliceStart + ' to: ' + sliceEnd);

        response.write(decrypted, 'binary');
        response.end(null, 'binary');
    });
    */
}