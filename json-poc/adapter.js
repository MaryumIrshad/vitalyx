'use strict';

const defaultQuestionDefinitions = require('./question-definitions');

function parseTextNumber(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function parseQuestionValue(questionId, value, trackerId, definitions = defaultQuestionDefinitions) {
  const definition = definitions[`${trackerId}:${questionId}`];
  if (!definition || typeof value !== 'string' || value.trim() === '') return null;
  if (definition.type === 'number') return parseTextNumber(value);
  if (definition.type === 'checkbox') {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) return null;
      return parsed.filter(item => item.trim() !== '' && item.toLowerCase() !== 'none of these');
    } catch {
      return null;
    }
  }
  if (definition.type === 'singleChoice' || definition.type === 'yesNo') return value.trim();
  return null;
}

function datePart(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value.trim());
  return match ? match[1] : null;
}

function timePart(value) {
  if (typeof value !== 'string') return '';
  const match = /T(\d{2}:\d{2})(?::\d{2})?/.exec(value);
  return match ? match[1] : '';
}

function normalizeQuality(reading, reports) {
  const acceptedStates = new Set(['acceptable', 'accepted', 'pass']);
  const rejectedStates = new Set(['notacceptable', 'not acceptable', 'rejected', 'poor', 'unacceptable']);
  const stateOf = value => String(value ?? '').trim().toLowerCase();
  const statuses = [reading.qualityStatus, ...reports.map(report => report?.qualityStatus)]
    .map(stateOf).filter(Boolean);
  const hasAccepted = statuses.some(status => acceptedStates.has(status));
  const hasRejected = statuses.some(status => rejectedStates.has(status));
  const flagPresent = typeof reading.accepted === 'boolean';
  const flagDisagrees = flagPresent && ((reading.accepted && hasRejected) || (!reading.accepted && hasAccepted));
  if (reading.qualityConflict === true || (hasAccepted && hasRejected) || flagDisagrees) {
    return { quality: 'conflicting', exclusionReason: 'Conflicting quality flag or reports' };
  }
  if (reading.accepted === true && hasAccepted && !hasRejected) {
    return { quality: 'accepted', exclusionReason: null };
  }
  return { quality: 'rejected', exclusionReason: 'Not explicitly accepted by available quality information' };
}

function makeDay(date) {
  return {
    date,
    trackerSubmitted: false,
    medicationReported: false,
    symptoms: [],
    zone: 'unknown',
    doses: null,
    readings: [],
    submissions: 0,
    rescue: null,
    school: null,
    feeling: null
  };
}

function normalizedReading(reading, deviceId, reports) {
  const quality = normalizeQuality(reading, reports);
  const rawFev1 = typeof reading.fev1_L === 'string' ? parseTextNumber(reading.fev1_L) : reading.fev1_L;
  const fev = Number.isFinite(rawFev1) && rawFev1 >= 0 ? rawFev1 : null;
  return {
    time: timePart(reading.measuredAt),
    fev,
    quality: fev === null && quality.quality === 'accepted' ? 'rejected' : quality.quality,
    readingId: reading.readingId ?? null,
    deviceId,
    qualityStatus: reading.qualityStatus ?? null,
    qualityReports: reports.map(report => ({
      qualityReportId: report?.qualityReportId ?? null,
      qualityStatus: report?.qualityStatus ?? null,
      instruction: report?.instruction ?? null
    })),
    exclusionReason: fev === null ? 'Missing or invalid FEV1 value' : quality.exclusionReason
  };
}

function latestByTime(current, candidate) {
  if (!candidate.value || typeof candidate.value !== 'string') return current;
  if (!current || candidate.at >= current.at) return candidate;
  return current;
}

function adaptPatientDocument(document, options = {}) {
  if (!document || typeof document !== 'object') throw new TypeError('Patient document must be an object');
  const definitions = options.questionDefinitions ?? defaultQuestionDefinitions;
  const days = new Map();
  const getDay = date => {
    if (!date) return null;
    if (!days.has(date)) days.set(date, makeDay(date));
    return days.get(date);
  };

  const medicationById = new Map((Array.isArray(document.medications) ? document.medications : [])
    .filter(medication => medication && medication.medicationId)
    .map(medication => [medication.medicationId, medication]));
  for (const log of Array.isArray(document.dailyLogs) ? document.dailyLogs : []) {
    const date = datePart(log?.date);
    const day = getDay(date);
    if (!day) continue;
    const trackerResponses = Array.isArray(log.trackerResponses) ? log.trackerResponses : [];
    const administrations = Array.isArray(log.medicationAdministrations) ? log.medicationAdministrations : [];
    day.submissions += trackerResponses.length;
    day.trackerSubmitted ||= trackerResponses.length > 0;
    day.medicationReported ||= administrations.length > 0;

    let feeling = null;
    let school = null;
    const symptomSet = new Set(day.symptoms);
    for (const submission of trackerResponses) {
      const trackerId = submission?.trackerId;
      if (!Array.isArray(submission?.responses)) continue;
      for (const response of submission.responses) {
        const definition = definitions[`${trackerId}:${response?.questionId}`];
        if (!definition) continue;
        const parsed = parseQuestionValue(response.questionId, response.value, trackerId, definitions);
        if (definition.field === 'symptoms' && Array.isArray(parsed)) parsed.forEach(symptom => symptomSet.add(symptom));
        if (definition.field === 'feeling') feeling = latestByTime(feeling, { value: parsed, at: submission.submittedAt ?? '' });
        if (definition.field === 'school' && Number.isFinite(parsed)) school = latestByTime(school, { value: String(parsed), number: parsed, at: submission.submittedAt ?? '' });
      }
    }
    day.symptoms = [...symptomSet];
    if (feeling) day.feeling = feeling.value;
    if (school) day.school = school.number;
    if (log.reportedActionPlanZone != null && String(log.reportedActionPlanZone).trim()) {
      day.zone = String(log.reportedActionPlanZone).trim().toLowerCase();
    }

    const controllerAmounts = [];
    const rescueAmounts = [];
    for (const administration of administrations) {
      const medication = medicationById.get(administration?.medicationId);
      const amount = parseTextNumber(administration?.value);
      if (!medication || amount === null) continue;
      if (medication.category === 'controller') controllerAmounts.push(amount);
      if (medication.category === 'rescue') rescueAmounts.push(amount);
    }
    if (controllerAmounts.length) day.doses = controllerAmounts.reduce((sum, amount) => sum + amount, 0);
    if (rescueAmounts.length) day.rescue = rescueAmounts.reduce((sum, amount) => sum + amount, 0);
  }

  for (const device of Array.isArray(document.medicalDevices) ? document.medicalDevices : []) {
    const readings = Array.isArray(device?.baselineReadings) ? device.baselineReadings : [];
    const reports = Array.isArray(device?.qualityReports) ? device.qualityReports : [];
    for (const reading of readings) {
      const date = datePart(reading?.measuredAt);
      const day = getDay(date);
      if (!day) continue;
      const matchedReports = reports.filter(report => report?.readingId === reading?.readingId);
      day.readings.push(normalizedReading(reading, device.deviceId ?? null, matchedReports));
    }
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function acceptedFev1Readings(day) {
  return (Array.isArray(day?.readings) ? day.readings : [])
    .filter(reading => reading?.quality === 'accepted' && Number.isFinite(reading.fev))
    .map(reading => reading.fev);
}

module.exports = { adaptPatientDocument, acceptedFev1Readings, parseTextNumber, parseQuestionValue, normalizeQuality };
