export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    const ct = request.headers.get('content-type') || '';
    let data = {};
    if (ct.includes('multipart/form-data') || ct.includes('application/x-www-form-urlencoded')) {
      const form = await request.formData();
      data = Object.fromEntries(form.entries());
    } else if (ct.includes('application/json')) {
      data = await request.json();
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported Media Type' }), {
        status: 415,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const { name = '', email = '', company = '', message = '', website = '' } = data;

    // Honeypot trip -> pretend success
    if (website) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    if (!name.trim() || !email.trim() || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';

    const bodyText =
`New contact form submission

Name:    ${name}
Email:   ${email}
Company: ${company}

Message:
${message}

Meta:
IP: ${ip}
UA: ${ua}
`;

    const mail = {
      personalizations: [{ to: [{ email: env.TO_EMAIL }] }],
      from: { email: env.FROM_EMAIL || 'no-reply@mcbays.com', name: env.FROM_NAME || 'McBays Website' },
      reply_to: [{ email, name }],
      subject: `New contact from ${name}`,
      content: [{ type: 'text/plain', value: bodyText }]
    };

    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mail),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(JSON.stringify({ error: 'Email failed', detail }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    });
  }
}
