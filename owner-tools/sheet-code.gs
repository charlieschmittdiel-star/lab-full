/**
 * Access-code checker for Gridiron Lab, Hardwood Lab and Pitch Lab.
 *
 * Paste this whole file into your codes Sheet under Extensions > Apps Script (replacing what's there),
 * save, then follow the setup guide. Players never see this Sheet: the games only ask
 * "is this code OK for this computer?" and get back yes or no.
 *
 * Columns on the "Codes" tab:
 *   Code          the 12-character code you give a buyer (ABCD-EFGH-JKLM)
 *   Buyer         who you gave it to
 *   Device limit  how many computers the code works on (blank = 2)
 *   Status        "active" or "off". Set to "off" to cancel a code.
 *   Devices used  filled in by the game. Clear this cell to let a buyer start over on new computers.
 *   First used / Last checked / Checks / Notes   for your records
 */

var TAB = 'Codes';
var HEAD = ['Code', 'Buyer', 'Device limit', 'Status', 'Devices used', 'First used', 'Last checked', 'Checks', 'Notes'];
var DEFAULT_LIMIT = 2;
var ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0 or 1, so codes are easy to read

// ---------- menu in the Sheet ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Game codes')
    .addItem('Make a new code', 'makeCode')
    .addItem('Turn off the selected code', 'turnOff')
    .addItem('Turn on the selected code', 'turnOn')
    .addItem('Reset devices for the selected code', 'resetDevices')
    .addSeparator()
    .addItem('Set up this sheet', 'setup')
    .addToUi();
}

function setup() {
  var sh = tab_();
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 160); sh.setColumnWidth(5, 220);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(['active', 'off'], true).setAllowInvalid(false).build();
  sh.getRange(2, 4, 999, 1).setDataValidation(rule);
  var msg = 'The Codes tab is ready.';
  if (sh.getLastRow() < 2) {
    var code = addCode_(sh, 'You (owner)', 3);
    msg += '\n\nYour own code (works on 3 computers):\n\n' + code;
  }
  SpreadsheetApp.getUi().alert(msg);
}

function makeCode() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('Make a new code', 'Who is this code for? (their name)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var name = String(r.getResponseText() || '').trim() || 'Buyer';
  var code = addCode_(tab_(), name, DEFAULT_LIMIT);
  ui.alert('Code for ' + name + ':\n\n' + code + '\n\nSend this to them with the game. It works on ' + DEFAULT_LIMIT +
    ' computers. You can change that in the "Device limit" column.');
}

function turnOff() { setSelected_(4, 'off', 'Turned off. That code stops working the next time the game checks in.'); }
function turnOn() { setSelected_(4, 'active', 'Turned back on.'); }
function resetDevices() { setSelected_(5, '', 'Devices cleared. The buyer can unlock again on new computers.'); }

// ---------- the check the games call ----------
function doGet(e) {
  var p = (e && e.parameter) || {};
  var res;
  try { res = check_(p.code, p.dev); } catch (err) { res = { ok: false, why: 'error' }; }
  var out = JSON.stringify(res);
  var cb = String(p.cb || '');
  if (/^[A-Za-z_$][\w$]{0,40}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + out + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

function check_(codeIn, devIn) {
  var code = clean_(codeIn), dev = clean_(devIn);
  if (code.length !== 12 || dev.length !== 8) return { ok: false, why: 'bad' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000); // two computers unlocking at the same moment take turns
  try {
    var sh = tab_();
    var last = sh.getLastRow();
    if (last < 2) return { ok: false, why: 'bad' };
    var rows = sh.getRange(2, 1, last - 1, HEAD.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (clean_(rows[i][0]) !== code) continue;
      var r = rows[i], row = i + 2;
      var status = String(r[3] || '').trim().toLowerCase();
      if (status && status !== 'active' && status !== 'on') return { ok: false, why: 'off' };
      var limit = parseInt(r[2], 10);
      if (!(limit > 0)) limit = DEFAULT_LIMIT;
      var devs = String(r[4] || '').split(/[\s,;]+/).map(clean_).filter(function (d) { return d.length === 8; });
      var now = new Date();
      if (devs.indexOf(dev) < 0) {
        if (devs.length >= limit) return { ok: false, why: 'full', lim: limit };
        devs.push(dev);
        sh.getRange(row, 5).setValue(devs.map(function (d) { return d.slice(0, 4) + '-' + d.slice(4); }).join(', '));
        if (!r[5]) sh.getRange(row, 6).setValue(now);
      }
      sh.getRange(row, 7, 1, 2).setValues([[now, (parseInt(r[7], 10) || 0) + 1]]);
      return { ok: true, name: String(r[1] || '').trim().split(/\s+/)[0], lim: limit, used: devs.length };
    }
    return { ok: false, why: 'bad' };
  } finally {
    lock.releaseLock();
  }
}

// ---------- helpers ----------
function tab_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB) || ss.insertSheet(TAB);
  if (String(sh.getRange(1, 1).getValue()) !== 'Code') {
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function clean_(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function newCode_(sh) {
  var used = {};
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (v) { used[clean_(v[0])] = 1; });
  for (var tries = 0; tries < 50; tries++) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid() + Date.now());
    var k = '';
    for (var i = 0; i < 12; i++) k += ALPHA[(bytes[i] + 256) % 32];
    if (!used[k]) return k.slice(0, 4) + '-' + k.slice(4, 8) + '-' + k.slice(8, 12);
  }
  throw new Error('Could not make a unique code');
}

function addCode_(sh, name, limit) {
  sh.getRange('A:A').setNumberFormat('@'); // keep codes as plain text
  var code = newCode_(sh);
  sh.appendRow([code, name, limit, 'active', '', '', '', 0, '']);
  return code;
}

function setSelected_(col, value, done) {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSheet();
  var row = sh.getActiveRange() ? sh.getActiveRange().getRow() : 0;
  if (sh.getName() !== TAB || row < 2 || !sh.getRange(row, 1).getValue()) {
    ui.alert('First click any cell in the row of the code you want to change (on the Codes tab).');
    return;
  }
  sh.getRange(row, col).setValue(value);
  ui.alert(sh.getRange(row, 1).getValue() + ' (' + sh.getRange(row, 2).getValue() + '): ' + done);
}
