var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
let { getDocument } = require('../helpers/mongo');
let { getIndicator } = require('../helpers/backtest');
let { clampRange } = require('../helpers/utils');
const { fork } = require('child_process');
// const tf = require('@tensorflow/tfjs-node-gpu');
const csv = require('csv');

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

router.get("/test", async (req, res) => {
    let csvPath = path.join(__dirname, `../sonar.csv`);
    let data = fs.readFileSync(csvPath, { encoding: "utf-8" });
    let features = [];
    let labels = [];

    csv.parse(data, {
        comment: '#'
    }, async function (err, output) {
        output.forEach(entry => {
            let label = entry.pop();
            let feature = [];
            entry.forEach(f => feature.push(parseFloat(f)));
            features.push(feature);
            labels.push(label == "M" ? [1] : [0]);
        })
        let predictionFeatures = features.splice(0, 10);
        let predictionLabels = labels.splice(0, 10);
        let inputShape = features[0].length;
        features = tf.tensor(features);
        labels = tf.tensor(labels);

        const model = tf.sequential();
        model.add(tf.layers.dense({ units: 10, inputShape: [inputShape], activation: 'relu' }));
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
            });
        }
        await train();

        model.predict(tf.tensor(predictionFeatures)).print();
        console.log(predictionLabels);
    });
});

module.exports = router;