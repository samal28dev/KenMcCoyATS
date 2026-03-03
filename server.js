const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

/**
 * Simple daily cron scheduler for agreement expiry checks.
 * Runs every 24 hours starting 60 seconds after server boot.
 */
function startAgreementCron() {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
        console.warn('[Cron] CRON_SECRET not set — agreement expiry checker disabled')
        return
    }
    const cronUrl = `http://${hostname}:${port}/api/agreements/cron`

    async function runCheck() {
        try {
            const res = await fetch(cronUrl, {
                headers: { 'x-cron-secret': cronSecret },
            })
            const data = await res.json()
            console.log(`[Cron] Agreement check completed:`, data)
        } catch (err) {
            console.error('[Cron] Agreement check failed:', err.message || err)
        }
    }

    // Run first check 60s after server start, then every 24 hours
    setTimeout(() => {
        runCheck()
        setInterval(runCheck, 24 * 60 * 60 * 1000) // 24 hours
    }, 60 * 1000)

    console.log('[Cron] Agreement expiry checker scheduled (every 24h)')
}

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        const parsedUrl = parse(req.url, true)
        handle(req, res, parsedUrl)
    })

    // Initialize Socket.io on the HTTP server
    const { initSocketIO } = require('./src/lib/socket')
    const io = initSocketIO(httpServer)

    // Start the daily agreement cron job
    startAgreementCron()

    httpServer.listen(port, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║  Ken McCoy Consulting ATS                        ║
║  ─────────────────────────────────────────────── ║
║  HTTP Server:   http://${hostname}:${port}             ║
║  WebSocket:     ws://${hostname}:${port}/api/socketio   ║
║  Mode:          ${dev ? 'Development' : 'Production'}                      ║
║  Real-Time:     ✅ Enabled (Socket.io)            ║
║  Cron:          ✅ Agreement expiry (daily)        ║
╚══════════════════════════════════════════════════╝
        `)
    })
})
