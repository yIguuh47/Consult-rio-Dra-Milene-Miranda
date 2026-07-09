/**
 * EME · Sistema de Agendamento
 * ---------------------------------
 * Fluxo:
 * 1. Paciente envia formulário do site
 * 2. Dra. recebe e-mail com links Confirmar / Recusar
 * 3. Ao confirmar → evento de 60 min no Google Agenda + convite ao paciente
 * 4. Paciente recebe e-mail de confirmação ou recusa
 *
 * SETUP: veja SETUP.md nesta pasta
 */

var CONFIG = {
  DOCTOR_EMAIL: 'dramilenemiranda@gmail.com',
  CALENDAR_ID: 'dramilenemiranda@gmail.com',
  DURATION_MINUTES: 60,
  TIMEZONE: 'America/Sao_Paulo',
  WORK_DAYS: [1, 2, 3, 4, 5], // Segunda a Sexta
  WORK_START_HOUR: 9,
  WORK_END_HOUR: 18,
  CLINIC_NAME: 'EME · Dra. Milene Miranda',
  CLINIC_ADDRESS: 'Alameda das Violetas, 100 · Sala 126 — Nova Arujá, Arujá - SP',
  WHATSAPP: '(11) 94787-3054',
  SHEET_NAME: 'Agendamentos'
};

// ─── Web App: POST (formulário do site) ───────────────────────────────────────

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var result = handleNewAppointment(data);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, message: err.message || 'Erro ao processar solicitação.' });
  }
}

// ─── Web App: GET (confirmar / recusar via e-mail da Dra.) ───────────────────

function doGet(e) {
  var action = (e.parameter.action || '').toLowerCase();
  var id = e.parameter.id || '';
  var token = e.parameter.token || '';

  try {
    if (action === 'book') {
      var booked = handleNewAppointment({
        nome: e.parameter.nome,
        telefone: e.parameter.telefone,
        email: e.parameter.email,
        interesse: e.parameter.interesse || '',
        mensagem: e.parameter.mensagem || '',
        data: e.parameter.data,
        hora: e.parameter.hora
      });
      return jsonResponse(booked);
    }
    if (action === 'approve') {
      var approved = handleApprove(id, token);
      return htmlPage('Agendamento confirmado', approved.message, true);
    }
    if (action === 'reject') {
      var rejected = handleReject(id, token);
      return htmlPage('Agendamento recusado', rejected.message, false);
    }
    return htmlPage('EME Agendamentos', 'Sistema de agendamento ativo.', true);
  } catch (err) {
    return htmlPage('Erro', err.message || 'Não foi possível processar esta ação.', false);
  }
}

// ─── Nova solicitação ─────────────────────────────────────────────────────────

function handleNewAppointment(data) {
  var nome = (data.nome || '').trim();
  var telefone = (data.telefone || '').trim();
  var email = (data.email || '').trim().toLowerCase();
  var interesse = (data.interesse || '').trim();
  var mensagem = (data.mensagem || '').trim();
  var dataConsulta = (data.data || '').trim();
  var horaConsulta = (data.hora || '').trim();

  if (!nome || !telefone || !email || !dataConsulta || !horaConsulta) {
    throw new Error('Preencha todos os campos obrigatórios.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('E-mail inválido.');
  }

  var start = parseDateTime(dataConsulta, horaConsulta);
  validateSlot(start);

  var end = new Date(start.getTime() + CONFIG.DURATION_MINUTES * 60000);
  if (hasCalendarConflict(start, end)) {
    throw new Error('Este horário já está ocupado. Por favor, escolha outro.');
  }

  var id = Utilities.getUuid();
  var token = generateToken(id);
  var sheet = getSheet();

  sheet.appendRow([
    id,
    new Date(),
    nome,
    telefone,
    email,
    interesse,
    mensagem,
    dataConsulta,
    horaConsulta,
    'PENDENTE',
    token,
    ''
  ]);

  sendPatientPending(email, nome, dataConsulta, horaConsulta);
  sendDoctorNotification(id, token, nome, telefone, email, interesse, mensagem, dataConsulta, horaConsulta);

  return {
    success: true,
    message: 'Recebemos sua solicitação! Você receberá um e-mail assim que a Dra. Milene confirmar o horário.'
  };
}

// ─── Confirmar ────────────────────────────────────────────────────────────────

function handleApprove(id, token) {
  var row = findRow(id, token);
  if (row.status !== 'PENDENTE') {
    throw new Error('Este agendamento já foi processado (status: ' + row.status + ').');
  }

  var start = parseDateTime(row.dataConsulta, row.horaConsulta);
  var end = new Date(start.getTime() + CONFIG.DURATION_MINUTES * 60000);

  if (hasCalendarConflict(start, end)) {
    throw new Error('Conflito de horário no Google Agenda. Escolha outro horário ou recuse este pedido.');
  }

  var title = 'Consulta — ' + row.nome + (row.interesse ? ' (' + row.interesse + ')' : '');
  var description = [
    'Paciente: ' + row.nome,
    'Telefone: ' + row.telefone,
    'E-mail: ' + row.email,
    row.interesse ? 'Tratamento: ' + row.interesse : '',
    row.mensagem ? 'Observações: ' + row.mensagem : '',
    '',
    'Confirmado via site EME'
  ].filter(Boolean).join('\n');

  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var event = calendar.createEvent(title, start, end, {
    description: description,
    location: CONFIG.CLINIC_ADDRESS,
    guests: row.email,
    sendInvites: true
  });

  updateRowStatus(row.rowIndex, 'CONFIRMADO', event.getId());
  sendPatientConfirmed(row.email, row.nome, row.dataConsulta, row.horaConsulta);

  return {
    message: 'Consulta confirmada para <strong>' + row.nome + '</strong> em ' +
      formatDateBR(row.dataConsulta, row.horaConsulta) +
      '. O paciente recebeu o convite por e-mail e o evento foi adicionado ao Google Agenda.'
  };
}

// ─── Recusar ──────────────────────────────────────────────────────────────────

function handleReject(id, token) {
  var row = findRow(id, token);
  if (row.status !== 'PENDENTE') {
    throw new Error('Este agendamento já foi processado (status: ' + row.status + ').');
  }

  updateRowStatus(row.rowIndex, 'RECUSADO', '');
  sendPatientRejected(row.email, row.nome, row.dataConsulta, row.horaConsulta);

  return {
    message: 'O pedido de <strong>' + row.nome + '</strong> foi recusado. O paciente foi notificado por e-mail.'
  };
}

// ─── Validações ───────────────────────────────────────────────────────────────

function parseDateTime(dateStr, timeStr) {
  var parts = dateStr.split('-');
  var timeParts = timeStr.split(':');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10) - 1;
  var day = parseInt(parts[2], 10);
  var hour = parseInt(timeParts[0], 10);
  var minute = parseInt(timeParts[1], 10);

  return new Date(year, month, day, hour, minute, 0);
}

function validateSlot(start) {
  var now = new Date();
  if (start <= now) {
    throw new Error('Escolha uma data e horário futuros.');
  }

  var day = start.getDay();
  if (CONFIG.WORK_DAYS.indexOf(day) === -1) {
    throw new Error('Atendemos de segunda a sexta. Escolha outro dia.');
  }

  var hour = start.getHours();
  var minute = start.getMinutes();
  if (hour < CONFIG.WORK_START_HOUR || hour >= CONFIG.WORK_END_HOUR) {
    throw new Error('Horário fora do expediente (09h às 18h).');
  }
  if (minute !== 0) {
    throw new Error('Selecione um horário válido.');
  }
  if (hour + CONFIG.DURATION_MINUTES / 60 > CONFIG.WORK_END_HOUR) {
    throw new Error('Não há tempo suficiente antes do fim do expediente. Escolha um horário mais cedo.');
  }
}

function hasCalendarConflict(start, end) {
  var calendar = CalendarApp.getCalendarById(CONFIG.CALENDAR_ID);
  var events = calendar.getEvents(start, end);
  return events.length > 0;
}

// ─── Planilha ─────────────────────────────────────────────────────────────────

function getSheet() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SPREADSHEET_ID');

  if (!sheetId) {
    throw new Error('Execute a função setup() no editor do Apps Script antes de usar o sistema.');
  }

  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'id', 'criadoEm', 'nome', 'telefone', 'email', 'interesse', 'mensagem',
      'dataConsulta', 'horaConsulta', 'status', 'token', 'calendarEventId'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(id, token) {
  var sheet = getSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id && data[i][10] === token) {
      return {
        rowIndex: i + 1,
        id: data[i][0],
        nome: data[i][2],
        telefone: data[i][3],
        email: data[i][4],
        interesse: data[i][5],
        mensagem: data[i][6],
        dataConsulta: data[i][7],
        horaConsulta: data[i][8],
        status: data[i][9],
        token: data[i][10]
      };
    }
  }
  throw new Error('Solicitação não encontrada ou link inválido.');
}

function updateRowStatus(rowIndex, status, eventId) {
  var sheet = getSheet();
  sheet.getRange(rowIndex, 10).setValue(status);
  if (eventId) {
    sheet.getRange(rowIndex, 12).setValue(eventId);
  }
}

// ─── E-mails ──────────────────────────────────────────────────────────────────

function sendPatientPending(email, nome, data, hora) {
  var subject = 'Recebemos sua solicitação de agendamento — ' + CONFIG.CLINIC_NAME;
  var body = [
    'Olá, ' + nome + '!',
    '',
    'Recebemos seu pedido de agendamento para ' + formatDateBR(data, hora) + '.',
    'A Dra. Milene Miranda irá analisar e confirmar manualmente.',
    '',
    'Assim que confirmado, você receberá outro e-mail com os detalhes e o convite do Google Agenda.',
    '',
    'Duração da consulta: ' + CONFIG.DURATION_MINUTES + ' minutos',
    '',
    'Com carinho,',
    CONFIG.CLINIC_NAME
  ].join('\n');

  GmailApp.sendEmail(email, subject, body, { name: CONFIG.CLINIC_NAME });
}

function sendDoctorNotification(id, token, nome, telefone, email, interesse, mensagem, data, hora) {
  var baseUrl = ScriptApp.getService().getUrl();
  var approveUrl = baseUrl + '?action=approve&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token);
  var rejectUrl = baseUrl + '?action=reject&id=' + encodeURIComponent(id) + '&token=' + encodeURIComponent(token);

  var subject = '📅 Novo pedido de agendamento — ' + nome;
  var body = [
    'Nova solicitação de agendamento pelo site:',
    '',
    'Paciente: ' + nome,
    'Telefone: ' + telefone,
    'E-mail: ' + email,
    'Data/hora solicitada: ' + formatDateBR(data, hora),
    'Duração: ' + CONFIG.DURATION_MINUTES + ' minutos',
    interesse ? 'Tratamento: ' + interesse : '',
    mensagem ? 'Mensagem: ' + mensagem : '',
    '',
    '── Ações ──',
    '',
    '✅ CONFIRMAR:',
    approveUrl,
    '',
    '❌ RECUSAR:',
    rejectUrl,
    '',
    'Ao confirmar, o evento será criado no Google Agenda e o paciente receberá o convite por e-mail.'
  ].filter(Boolean).join('\n');

  GmailApp.sendEmail(CONFIG.DOCTOR_EMAIL, subject, body, { name: 'Site EME' });
}

function sendPatientConfirmed(email, nome, data, hora) {
  var subject = '✅ Consulta confirmada — ' + CONFIG.CLINIC_NAME;
  var body = [
    'Olá, ' + nome + '!',
    '',
    'Sua consulta foi confirmada pela Dra. Milene Miranda.',
    '',
    'Data e horário: ' + formatDateBR(data, hora),
    'Duração: ' + CONFIG.DURATION_MINUTES + ' minutos',
    'Endereço: ' + CONFIG.CLINIC_ADDRESS,
    'WhatsApp: ' + CONFIG.WHATSAPP,
    '',
    'Você também receberá um convite do Google Agenda no seu e-mail.',
    '',
    'Até breve!',
    CONFIG.CLINIC_NAME
  ].join('\n');

  GmailApp.sendEmail(email, subject, body, { name: CONFIG.CLINIC_NAME });
}

function sendPatientRejected(email, nome, data, hora) {
  var subject = 'Sobre seu pedido de agendamento — ' + CONFIG.CLINIC_NAME;
  var body = [
    'Olá, ' + nome + ',',
    '',
    'Infelizmente não foi possível confirmar o horário solicitado (' + formatDateBR(data, hora) + ').',
    '',
    'Por favor, acesse nosso site e escolha outro horário, ou entre em contato pelo WhatsApp: ' + CONFIG.WHATSAPP,
    '',
    'Com carinho,',
    CONFIG.CLINIC_NAME
  ].join('\n');

  GmailApp.sendEmail(email, subject, body, { name: CONFIG.CLINIC_NAME });
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function generateToken(id) {
  var secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET') || 'eme-default-secret';
  var raw = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    id + secret,
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(raw).substring(0, 32);
}

function formatDateBR(dateStr, timeStr) {
  var parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0] + ' às ' + timeStr;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function htmlPage(title, message, success) {
  var color = success ? '#b59e8f' : '#5C4D43';
  var html = '<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title>' +
    '<style>body{font-family:Georgia,serif;background:#fffaf5;color:#5C4D43;' +
    'display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}' +
    '.card{max-width:480px;background:#fff;border:1px solid #e6d6c9;border-radius:4px;padding:40px;text-align:center;}' +
    'h1{color:' + color + ';font-weight:400;font-size:1.5rem;}' +
    'p{line-height:1.6;font-size:0.95rem;}</style></head><body>' +
    '<div class="card"><h1>' + title + '</h1><p>' + message + '</p></div></body></html>';

  return HtmlService.createHtmlOutput(html).setTitle(title);
}

// ─── Setup inicial (rodar UMA VEZ no editor) ──────────────────────────────────

function setup() {
  var props = PropertiesService.getScriptProperties();

  if (!props.getProperty('TOKEN_SECRET')) {
    props.setProperty('TOKEN_SECRET', Utilities.getUuid());
  }

  var sheetId = props.getProperty('SPREADSHEET_ID');
  if (!sheetId) {
    var ss = SpreadsheetApp.create('EME — Agendamentos');
    sheetId = ss.getId();
    props.setProperty('SPREADSHEET_ID', sheetId);

    var sheet = ss.getActiveSheet();
    sheet.setName(CONFIG.SHEET_NAME);
    sheet.appendRow([
      'id', 'criadoEm', 'nome', 'telefone', 'email', 'interesse', 'mensagem',
      'dataConsulta', 'horaConsulta', 'status', 'token', 'calendarEventId'
    ]);
    sheet.setFrozenRows(1);

    Logger.log('Planilha criada: ' + ss.getUrl());
  }

  Logger.log('Setup concluído! Agora faça o Deploy da Web App (veja SETUP.md).');
}
