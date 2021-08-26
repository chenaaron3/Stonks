// returns a promise that is resolved when the job is finished
type Job = () => Promise<void>

let queue: Job[] = [];

// if something is running
let busy = false;

function addJob(func: Job, first = false) {
    let position = queue.length + (busy ? 1 : 0);

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
        let func = queue.shift();
        if (func) {
            await func();
        }
        busy = false;
        runJobs();
    }
}

export { addJob }