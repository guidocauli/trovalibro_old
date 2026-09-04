// Piccolo wrapper attorno a fetch() per le chiamate alle API REST del backend.
// Centralizza la gestione JSON, gli errori e l'invio dei cookie di sessione.
const api = {
    async request(method, url, body, isFormData = false) {
        const opts = { method, credentials: 'same-origin' };
        if (body !== undefined) {
            if (isFormData) {
                opts.body = body; // FormData: il browser imposta da solo il Content-Type multipart
            } else {
                opts.headers = { 'Content-Type': 'application/json' };
                opts.body = JSON.stringify(body);
            }
        }
        const res = await fetch(url, opts);
        let data = null;
        try { data = await res.json(); } catch { /* risposta senza corpo */ }
        if (!res.ok) {
            const message = (data && data.error) || `Errore ${res.status}`;
            throw new Error(message);
        }
        return data;
    },
    get(url) { return this.request('GET', url); },
    post(url, body) { return this.request('POST', url, body); },
    put(url, body) { return this.request('PUT', url, body); },
    del(url) { return this.request('DELETE', url); },
    postForm(url, formData) { return this.request('POST', url, formData, true); },
    putForm(url, formData) { return this.request('PUT', url, formData, true); },
};
