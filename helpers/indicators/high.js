let { isCrossed, getSimpleMovingAverage, clampRange } = require('../utils');
let Indicator = require('./indicator');

class High extends Indicator {
    initialize(options) {
        this.name = "High";
        this.period = options["period"];
        this.graph = this.calculate();
    }

    calculate() {
        let graph = {}

        var maxSlidingWindow = function (nums, k) {
            const q = [];  // stores *indices*
            const res = [];
            for (let i = 0; i < nums.length; i++) {
                while (q && nums[q[q.length - 1]] <= nums[i]) {
                    q.pop();
                }
                q.push(i);
                // remove first element if it's outside the window
                if (q[0] === i - k) {
                    q.shift();
                }
                res.push(nums[q[0]]);
            }
            return res;
        };

        let flatClose = [];
        this.dates.forEach((date) => {
            flatClose.push(this.closes[date]);
        });

        let maxes = maxSlidingWindow(flatClose, this.period);

        this.dates.forEach((date, i) => {
            graph[date] = maxes[i]
        });

        return graph;
    }

    getGraph() {
        return { "High": this.graph };
    }

    getValue(date) {
        return this.graph[date];
    }

    normalize(data) {
        return clampRange(data);
    }

    getAction(date, dateIndex, isMain) {
        return Indicator.NOACTION;
    }
}

module.exports = High;