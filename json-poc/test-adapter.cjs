'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { adaptPatientDocument, acceptedFev1Readings, parseTextNumber, parseQuestionValue } = require('./adapter');
const questionDefinitions = require('./question-definitions');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fictional-patient.json'), 'utf8'));
const days = adaptPatientDocument(fixture);

assert.deepEqual(days.map(day => day.date), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
const day1 = days[0];
assert.deepEqual(Object.keys(day1), ['date', 'trackerSubmitted', 'medicationReported', 'symptoms', 'zone', 'doses', 'readings', 'submissions', 'rescue', 'school', 'feeling']);
assert.equal(day1.trackerSubmitted, true);
assert.equal(day1.medicationReported, true);
assert.equal(day1.submissions, 2, 'Repeated daily submissions are counted');
assert.deepEqual(day1.symptoms.sort(), ['Coughing', 'Wheezing'], 'Symptoms union across submissions');
assert.equal(day1.feeling, 'Okay', 'Scalar response uses the latest nonblank submission');
assert.equal(day1.school, 1, 'Blank latest school response does not erase the prior numeric response');
assert.equal(day1.zone, 'yellow');
assert.equal(day1.doses, 1, 'Controller medication ID resolves to a patient-reported dose');
assert.equal(day1.rescue, 1, 'Rescue medication ID resolves separately');
assert.equal(day1.readings.length, 2, 'Accepted and rejected device attempts remain inspectable');
assert.deepEqual(day1.readings.map(reading => reading.quality), ['accepted', 'rejected']);
assert.deepEqual(acceptedFev1Readings(day1), [2.48], 'Only accepted FEV1 contributes to accepted values');
assert.equal(day1.readings[1].qualityReports.length, 1);

const day2 = days[1];
assert.equal(day2.trackerSubmitted, false);
assert.equal(day2.medicationReported, true, 'Medication reporting is independent from tracker submission');
assert.equal(day2.submissions, 0);
assert.deepEqual(day2.symptoms, []);
assert.equal(day2.doses, 1);
assert.equal(day2.rescue, null, 'No rescue report remains unknown, not a reported zero');
assert.deepEqual(day2.readings, [], 'No device reading does not create a zero reading');
assert.equal(day2.feeling, null);
assert.equal(day2.school, null);

const day3 = days[2];
assert.equal(day3.trackerSubmitted, true);
assert.equal(day3.medicationReported, false, 'Tracker submission does not imply medication reporting');
assert.equal(day3.doses, null);
assert.equal(day3.rescue, null);
assert.deepEqual(day3.symptoms, [], 'Explicit None of these is a recorded negative');
assert.equal(day3.school, 0, 'Explicit text zero remains a value');
assert.equal(day3.readings.length, 2, 'Conflicting and rejected attempts remain inspectable');
assert.deepEqual(day3.readings.map(reading => reading.quality), ['conflicting', 'conflicting']);
assert.deepEqual(acceptedFev1Readings(day3), []);

const day4 = days[3];
assert.equal(day4.trackerSubmitted, false);
assert.equal(day4.medicationReported, false);
assert.equal(day4.doses, null);
assert.equal(day4.rescue, null);
assert.deepEqual(day4.readings, []);
assert.equal(day4.zone, 'unknown');

assert.equal(parseTextNumber(' 2.75 '), 2.75);
assert.equal(parseTextNumber(''), null);
assert.equal(parseTextNumber('2.3L'), null);
assert.deepEqual(parseQuestionValue('q-symptoms', '["Coughing","None of these"]', 'tracker-asthma-demo', questionDefinitions), ['Coughing']);
assert.equal(parseQuestionValue('q-fev1-reading', '2.48', 'tracker-asthma-demo', questionDefinitions), 2.48, 'Text-encoded numeric device response is parsed by question definition');
assert.equal(parseQuestionValue('q-symptoms', 'not-json', 'tracker-asthma-demo', questionDefinitions), null);
assert.equal(parseQuestionValue('q-school-days', 'not-a-number', 'tracker-asthma-demo', questionDefinitions), null);

const duplicateLog = {
  date: '2026-10-01',
  trackerResponses: [{ trackerId: 'tracker-asthma-demo', submittedAt: '2026-10-01T22:00:00-04:00', responses: [] }],
  medicationAdministrations: []
};
const duplicated = adaptPatientDocument({ ...fixture, dailyLogs: [...fixture.dailyLogs, duplicateLog] });
assert.equal(duplicated[0].submissions, 3, 'Duplicate date log entries merge without losing submission counts');

const optionalFields = adaptPatientDocument({ patientId: 'FIC-EMPTY', dailyLogs: [{ date: '2026-10-05' }] });
assert.equal(optionalFields.length, 1, 'Optional arrays may be absent');
assert.equal(optionalFields[0].trackerSubmitted, false);
assert.equal(optionalFields[0].medicationReported, false);
assert.equal(optionalFields[0].doses, null);

const unknownQuality = adaptPatientDocument({
  patientId: 'FIC-QUALITY', dailyLogs: [], medications: [], trackers: [],
  medicalDevices: [{ deviceId: 'D', baselineReadings: [{ readingId: 'R', measuredAt: '2026-10-05T10:00:00', fev1_L: 2.2 }], qualityReports: [] }]
});
assert.equal(unknownQuality[0].readings[0].quality, 'rejected', 'A reading without explicit accepted quality is excluded');
assert.deepEqual(acceptedFev1Readings(unknownQuality[0]), []);

console.log(`PASS: ${days.length} fictional patient-days normalized; duplicates, text parsing, independent missing streams, medication mapping, and spirometry quality checks verified.`);
