self.addEventListener('message', (event) => {
    const payload = event?.data || {}
    if (payload.type !== 'counter:expensive-check') return

    const counter = Number(payload.counter) || 0

    // Simulate deterministic CPU work to demonstrate worker offloading.
    let checksum = 0
    for (let index = 0; index < 20000; index += 1) {
        checksum = (checksum + counter * (index + 3)) % 1000003
    }

    self.postMessage({
        type: 'worker:result',
        message: 'Worker checksum ' + checksum + ' for counter ' + counter
    })
})
