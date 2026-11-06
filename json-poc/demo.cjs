'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { adaptPatientDocument } = require('./adapter');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fictional-patient.json'), 'utf8'));
process.stdout.write(`${JSON.stringify(adaptPatientDocument(fixture), null, 2)}\n`);
