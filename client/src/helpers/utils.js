// format date to api needs
function formatDate(date) {
    if (typeof date == "string") {
        date = new Date(date);
    }

    // add 1 day, data is off
    date.setDate(date.getDate() + 1);

    var year = date.getFullYear();

    var month = (1 + date.getMonth()).toString();
    month = month.length > 1 ? month : '0' + month;

    var day = date.getDate().toString();
    day = day.length > 1 ? day : '0' + day;

    return month + '/' + day + '/' + year % 100;
}

function daysBetween(date1, date2) {
    // The number of milliseconds in one day
    const ONE_DAY = 1000 * 60 * 60 * 24;
    // Calculate the difference in milliseconds
    const differenceMs = Math.abs(date1 - date2);
    // Convert back to days and return
    return Math.round(differenceMs / ONE_DAY);
}

function hoursBetween(dt1, dt2) {
    var diff = (dt2.getTime() - dt1.getTime()) / 1000;
    diff /= (60 * 60);
    return Math.round(diff);
}

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function camelToDisplay(s) {
    return s.replace(/([A-Z])/g, ' $1')
        .replace(/^./, function (str) { return str.toUpperCase(); });
}

function displayDelta(p) {
    return (p >= 0 ? "+" : "") + p.toFixed(2);
}

function getBacktestDisplayName(options) {
    let indicatorsUsed = new Set();
    Object.keys(options["buyIndicators"]).forEach(i => indicatorsUsed.add(i));
    Object.keys(options["sellIndicators"]).forEach(i => indicatorsUsed.add(i));
    indicatorsUsed = [...indicatorsUsed];
    indicatorsUsed.sort();
    return indicatorsUsed.join("/");
}

module.exports = { formatDate, daysBetween, hoursBetween, numberWithCommas, camelToDisplay, displayDelta, getBacktestDisplayName };