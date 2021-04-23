var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
let { createDataset } = require('../helpers/stock');
let { getDocument } = require('../helpers/mongo');
let { getIndicator } = require('../helpers/backtest');
let { clampRange } = require('../helpers/utils');
const { fork } = require('child_process');
const tf = require('@tensorflow/tfjs-node-gpu');
const csv = require('csv');

router.get("/createDataset", async (req, res) => {
    let id = req.query.id;
    let window = req.query.window;
    let result;
    try {
        result = await getDocument("results", id);
    }
    catch {
        res.json({ error: "ID not valid!" });
        return;
    }
    if (typeof (result["results"]) == "string") {
        res.json({ error: "Results are not ready yet!" });
    }
    else {
        res.send("Creating dataset");
        createDataset(id, result, window);
    }
})

router.get("/generateDataset", async (req, res) => {
    let features = [];
    let labels = [];
    let base = [1, .7, .5, .3, .1, .2, .25, .3, .4, .7, .8, .9, .86, 1];
    let base2 = [0, .1, .2, .3, .4, .5, .6, .7, .8, .7, .6, .5, .4, .2];
    let deviation = 1;
    for (let i = 0; i < 100; ++i) {
        feature = [...base];
        feature.forEach((f, i) => {
            feature[i] += (Math.random() * 2 - 1) * deviation;
        })
        features.push(feature);
        labels.push(0)

        feature = [...base2];
        feature.forEach((f, i) => {
            feature[i] += (Math.random() * 2 - 1) * deviation;
        })
        features.push(feature);
        labels.push(1)
    }
    fs.writeFileSync(path.join(__dirname, `../data/generated.json`), JSON.stringify({ features, labels }));
    res.send("ok");
});

router.get("/trainModel", async (req, res) => {
    let id = req.query.id;

    let features = [];
    let labels = [];
    let doc = await getDocument("indicators", id);
    let symbols = Object.keys(doc["data"]);
    let featureNames = doc["data"][symbols[0]]["fields"];
    let desiredFeatures = [4];
    console.log(featureNames);
    symbols.forEach(symbol => {
        doc["data"][symbol]["data"].forEach(entry => {
            feature = [];
            entry["indicators"].forEach((f, i) => {
                if (desiredFeatures.includes(i)) {
                    feature.push(f);
                }
            })
            features.push(feature);
            labels.push(entry["percentProfit"] > 0 ? [1] : [0]);
        })
    })
    let predictionFeatures = features.splice(0, 10);
    let predictionLabels = labels.splice(0, 10);
    let inputShape = features[0].length;
    features = tf.tensor(features);
    labels = tf.tensor(labels);

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, inputShape: [inputShape], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({
        loss: 'binaryCrossentropy',
        optimizer: "adam",
        metrics: ['accuracy']
    });

    res.send("ok")

    // Start model training process.
    async function train() {
        await model.fit(features, labels, {
            epochs: 10,
            validationSplit: .3,
            shuffle: true,
        });
    }
    await train();
    // console.log(predictionFeatures, predictionLabels);
    let evaluated = await model.evaluate(tf.tensor(predictionFeatures), tf.tensor(predictionLabels));
    evaluated[0].print()
    evaluated[1].print()
    console.log(predictionLabels);
    model.predict(tf.tensor(predictionFeatures)).print();

});

router.get("/test2", async (req, res) => {
    let csvPath = path.join(__dirname, `../data/JUgZVIIZuY_14.json`); //JUgZVIIZuY
    let data = JSON.parse(fs.readFileSync(csvPath, { encoding: "utf-8" }));
    let features = [];
    let labels = [];
    let pairs = [];

    data["features"].forEach((feature, i) => {
        let label = data["labels"][i];
        pairs.push({ feature: feature, label: label });
    })

    shuffle(pairs);
    features = [];
    labels = [];
    pairs.forEach(pair => {
        features.push(pair["feature"]);
        labels.push(pair["label"]);
    })

    let predictionFeatures = features.splice(0, 20);
    let predictionLabels = labels.splice(0, 20);
    let inputShape = features[0].length;
    features = tf.tensor(features);
    labels = tf.tensor(labels);

    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 30, inputShape: [inputShape], activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    model.compile({
        loss: 'binaryCrossentropy',
        optimizer: "adam", //tf.train.sgd(.0001),
        metrics: ['accuracy']
    });

    res.send("ok")

    // Start model training process.
    async function train() {
        await model.fit(features, labels, {
            epochs: 100,
            validationSplit: .2,
            shuffle: true,
            callbacks: tf.node.tensorBoard('D:/Desktop/tmp/JUgZVIIZuY_14_30')
        });
    }
    await train();

    let prediction = model.predict(tf.tensor(predictionFeatures));
    let eval_train = model.evaluate(features, labels);
    let eval_val = model.evaluate(tf.tensor(predictionFeatures), tf.tensor(predictionLabels));
    eval_train[0].print();
    eval_train[1].print();
    eval_val[0].print();
    eval_val[1].print();
    binarize(prediction).as1D().print()
    console.log(predictionLabels);

    await model.save('file://mlModels/JUgZVIIZuY_14')
});


router.get("/test", async (req, res) => {
    let csvPath = path.join(__dirname, `../sonar.csv`);
    let data = fs.readFileSync(csvPath, { encoding: "utf-8" });
    let features = [];
    let labels = [];
    let pairs = [];

    csv.parse(data, {
        comment: '#'
    }, async function (err, output) {
        output.forEach(entry => {
            let label = entry.pop();
            let feature = [];
            entry.forEach(f => feature.push(parseFloat(f)));
            pairs.push({ feature: feature, label: label == "M" ? [1] : [0] });
            features.push(feature);
            labels.push(label == "M" ? [1] : [0]);
        })

        shuffle(pairs);
        features = [];
        labels = [];
        pairs.forEach(pair => {
            features.push(pair["feature"]);
            labels.push(pair["label"]);
        })

        let predictionFeatures = features.splice(0, 20);
        let predictionLabels = labels.splice(0, 20);
        let inputShape = features[0].length;
        features = tf.tensor(features);
        labels = tf.tensor(labels);

        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 60, inputShape: [inputShape], activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

        // model = await tf.loadLayersModel('file://mlModels/sonar/model.json');

        model.compile({
            loss: 'binaryCrossentropy',
            optimizer: "adam", //tf.train.sgd(.0001),
            metrics: ['accuracy'],
        });

        res.send("ok")

        // Start model training process.
        async function train() {
            await model.fit(features, labels, {
                epochs: 500,
                validationSplit: .2,
                shuffle: true,
                callbacks: tf.node.tensorBoard('D:/Desktop/tmp/sonar_60_500epohcs')
            });
        }
        await train();

        let prediction = model.predict(tf.tensor(predictionFeatures));
        let eval_train = model.evaluate(features, labels);
        let eval_val = model.evaluate(tf.tensor(predictionFeatures), tf.tensor(predictionLabels));
        eval_train[0].print();
        eval_train[1].print();
        eval_val[0].print();
        eval_val[1].print();
        binarize(prediction).as1D().print()
        console.log(predictionLabels);

        await model.save('file://mlModels/sonar')
    });
});

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

function binarize(y, threshold) {
    if (threshold == null) {
        threshold = 0.5;
    }
    tf.util.assert(
        threshold >= 0 && threshold <= 1,
        `Expected threshold to be >=0 and <=1, but got ${threshold}`);

    return tf.tidy(() => {
        const condition = y.greater(tf.scalar(threshold));
        return tf.where(condition, tf.onesLike(y), tf.zerosLike(y));
    });
}

module.exports = router;