let queue = [];

// if something is running
busy = false;

function addJob(func, first) {
    let position = queue.length + (this.busy ? 1 : 0);

    // add job to list
    if (first) {
        queue.unshift(func);
    }
    else {
        queue.push(func);
    }

    // start running jobs if not already
    if (!busy) {
        runJobs();
    }

    return position;
}

async function runJobs() {
    if (queue.length == 0) {
        return;
    }
    else {
        // keep running jobs
        busy = true;
        func = queue.shift();
        await func();
        busy = false;
        runJobs();
    }
}

module.exports = { addJob }