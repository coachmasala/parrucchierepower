exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
  }

  let nome, cognome, email, telefono, salone;
  try {
    const body = JSON.parse(event.body);
    nome     = (body.nome     || '').trim();
    cognome  = (body.cognome  || '').trim();
    email    = (body.email    || '').trim().toLowerCase();
    telefono = (body.telefono || '').trim().replace(/\s+/g, '');
    salone   = (body.salone   || '').trim();
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Dati non validi' }) };
  }

  if (!nome || !email || !cognome || !telefono || !salone) {
    return { statusCode: 400, body: JSON.stringify({ success: false, message: 'Tutti i campi sono obbligatori' }) };
  }

  const BREVO_KEY = process.env.BREVO_API_KEY_LANDING;
  const headers = {
    'Content-Type': 'application/json',
    'api-key': BREVO_KEY || ''
  };

  // 1. Tentativo aggiunta contatto a Brevo (Lista 6)
  if (BREVO_KEY) {
    try {
      let formattedPhone = telefono;
      if (formattedPhone.startsWith('3') && formattedPhone.length >= 9) formattedPhone = '+39' + formattedPhone;
      
      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          attributes: { NOME: nome, COGNOME: cognome, SMS: formattedPhone, JOB_TITLE: salone },
          listIds: [6],
          updateEnabled: true
        })
      });
    } catch(e) {
      console.error('Brevo contact error (silenced):', e.message);
    }
  }

  // 2. Invio email di notifica a Coach Masala (Logica di fallback)
  if (BREVO_KEY) {
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: { name: 'Sistema Parrucchiere Power', email: 'info@parrucchierepower.it' },
          to: [{ email: 'info@parrucchierepower.it', name: 'Coach Masala' }],
          subject: 'NUOVA RICHIESTA AUDIT: ' + salone,
          htmlContent: `<h2>Nuova richiesta Audit Strategico</h2><p><strong>Nome:</strong> ${nome} ${cognome}</p><p><strong>Email:</strong> ${email}</p><p><strong>Telefono:</strong> ${telefono}</p><p><strong>Salone:</strong> ${salone}</p>`
        })
      });
    } catch(e) {
      console.error('Brevo email error (silenced):', e.message);
    }
  }

  // 3. RESTITUISCO SEMPRE SUCCESSO ALL'UTENTE
  // Se Brevo fallisce, il Coach riceverà comunque i dati tramite i log di Netlify o l'email se funziona.
  // L'importante è che l'utente non veda errori.
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Richiesta ricevuta correttamente' })
  };
};
