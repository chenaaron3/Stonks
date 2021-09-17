import express, { json, Request } from 'express';
import fs = require('fs');
import path = require('path');
import { createDataset } from '../helpers/stock';
import { getDocument } from '../helpers/mongo';
import { getIndicator } from '../helpers/backtest';
import { clampRange } from '../helpers/utils';
import { fork } from 'child_process';
// import * as tf from '@tensorflow/tfjs-node-gpu';
import csv from 'csv';

import { MongoResults, MongoIndicators } from '../types/types';

let router = express.Router();

const DATA_PATH = path.join(__dirname, `..`, `data`)
const MODEL_PATH = path.resolve(path.join(__dirname, '..', 'mlModels'));

/*
// Create dataset based on prices, save in json file
router.get("/createDataset", async (req: Request<{}, {}, {}, { id: string, window: number }>, res) => {
    let id = req.query.id;
    let window = req.query.window;
    let result = await getDocument<MongoResults>("results", id);
    if (!result) {
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

// generate dummy data to test
router.get("/generateDataset", async (req, res) => {
    let features = [];
    let labels = [];
    let base = [1, .7, .5, .3, .1, .2, .25, .3, .4, .7, .8, .9, .86, 1];
    let base2 = [0, .1, .2, .3, .4, .5, .6, .7, .8, .7, .6, .5, .4, .2];
    let deviation = 1;
    for (let i = 0; i < 100; ++i) {
        let feature = [...base];
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
    if (!fs.existsSync(DATA_PATH)) {
        try {
            fs.mkdirSync(DATA_PATH);
        }
        catch {
        }
    }
    fs.writeFileSync(path.join(__dirname, `../data/generated.json`), JSON.stringify({ features, labels }));
    res.send("ok");
});

// train based on indicators
router.get("/trainModel", async (req: Request<{}, {}, {}, { id: string }>, res) => {
    let id = req.query.id;

    let features: number[][] = [];
    let labels: number[][] = [];
    let doc = await getDocument<MongoIndicators>("indicators", id);
    if (!doc) return;
    let symbols = Object.keys(doc["data"]);
    let featureNames = doc["data"][symbols[0]]["fields"];
    let desiredFeatures = [4];
    console.log(featureNames);
    symbols.forEach(symbol => {
        doc!["data"][symbol]["data"].forEach(entry => {
            let feature: number[] = [];
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
    let tensorFeatures = tf.tensor(features);
    let tensorLabels = tf.tensor(labels);

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
        await model.fit(tensorFeatures, tensorLabels, {
            epochs: 10,
            validationSplit: .3,
            shuffle: true,
        });
    }
    await train();
    // console.log(predictionFeatures, predictionLabels);
    let evaluated = model.evaluate(tf.tensor(predictionFeatures), tf.tensor(predictionLabels)) as tf.Scalar[];
    evaluated[0].print()
    evaluated[1].print()
    console.log(predictionLabels);
    (model.predict(tf.tensor(predictionFeatures)) as tf.Tensor<tf.Rank>).print();

});

interface TrainResults {
    metrics: string[];
    train: number[];
    validation: number[];
    prediction: {
        labels: number[];
        actual: any;
    };
};

// train based on prices
router.get("/train", async (req: Request<{}, {}, {}, { id: string }>, res) => {
    const id = req.query.id || 'generated';
    res.send("ok");
    let unitsArray = [15, 30, 60, 90];
    let results: { [key: string]: TrainResults } = {};

    for (let layers = 0; layers < 5; ++layers) {
        for (let unitsIndex = 0; unitsIndex < unitsArray.length; ++unitsIndex) {
            let units = unitsArray[unitsIndex];
            let entry = await train(id, layers, units);
            results[`${id}_${layers}_${units}`] = entry;
        }
    }

    fs.writeFileSync(path.join(DATA_PATH, `${id}_results.json`), JSON.stringify(results));
});

const train = async (id: string, layers: number, units: number) => {
    // get data
    let { features, labels } = getData(id);

    // split data
    let predictionFeatures = features.splice(0, 20);
    let predictionLabels = labels.splice(0, 20);
    let inputShape = features[0].length;
    let tensorFeatures = tf.tensor(features);
    let tensorLabels = tf.tensor(labels);

    let modelPath = path.join(MODEL_PATH, `${id}_${layers}_${units}`)
    let model: tf.Sequential;
    if (fs.existsSync(modelPath)) {
        model = (await tf.loadLayersModel(`file://${path.join(modelPath, 'model.json')}`)) as tf.Sequential;
    }
    else {
        model = createModel(inputShape, layers, units);
    }

    model.compile({
        loss: 'binaryCrossentropy',
        optimizer: "adam",
        metrics: ['accuracy']
    });

    // Start model training process.
    async function train() {
        await model.fit(tensorFeatures, tensorLabels, {
            epochs: 100,
            validationSplit: .2,
            shuffle: true,
            callbacks: tf.node.tensorBoard(`D:/Desktop/tmp/${id}_${layers}_${units}`)
        });
    }
    await train();

    let prediction = model.predict(tf.tensor(predictionFeatures));
    let eval_train = model.evaluate(tensorFeatures, tensorLabels) as tf.Scalar[];
    let eval_val = model.evaluate(tf.tensor(predictionFeatures), tf.tensor(predictionLabels)) as tf.Scalar[];
    let results = {
        metrics: model.metricsNames,
        train: [eval_train[0].arraySync(), eval_train[1].arraySync()],
        validation: [eval_val[0].arraySync(), eval_val[1].arraySync()],
        prediction: {
            labels: predictionLabels,
            actual: binarize(prediction).as1D().arraySync()
        }
    }
    console.log(results)

    if (!fs.existsSync(MODEL_PATH)) {
        try {
            fs.mkdirSync(MODEL_PATH);
        }
        catch {
        }
    }
    await model.save(`file://${modelPath}`)

    return results;
}

// train based on prices
router.get("/eval", async (req: Request<{}, {}, {}, { id: string, layers: number, units: number }>, res) => {
    const id = req.query.id || 'generated';
    const layers = req.query.layers;
    const units = req.query.units;

    let { features, labels } = getData(id);
    let inputShape = features[0].length;

    let modelPath = path.join(MODEL_PATH, `${id}_${layers}_${units}`)
    let model: tf.Sequential;
    if (fs.existsSync(modelPath)) {
        model = (await tf.loadLayersModel(`file://${path.join(modelPath, 'model.json')}`)) as tf.Sequential;
    }
    else {
        model = createModel(inputShape, layers, units);
    }

    model.compile({
        loss: 'binaryCrossentropy',
        optimizer: "adam",
        metrics: ['accuracy']
    });

    let eval_val = model.evaluate(tf.tensor(features), tf.tensor(labels)) as tf.Scalar[];
    res.json({ results: [eval_val[0].arraySync(), eval_val[1].arraySync()] });
});

const getData = (id: string) => {
    let csvPath = path.join(DATA_PATH, `${id}.json`);
    let data = JSON.parse(fs.readFileSync(csvPath, { encoding: "utf-8" })) as { features: number[][]; labels: number[] };
    let pairs: { feature: number[]; label: number }[] = [];

    data["features"].forEach((feature, i) => {
        let label = data["labels"][i];
        pairs.push({ feature: feature, label: label });
    })

    shuffle(pairs);
    let features: number[][] = [];
    let labels: number[] = [];
    pairs.forEach(pair => {
        features.push(pair["feature"]);
        labels.push(pair["label"]);
    })
    return { features, labels }
}

const createModel = (inputShape: number, layers: number, units: number) => {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: units, inputShape: [inputShape], activation: 'relu' }));
    for (let i = 0; i < layers; ++i) {
        model.add(tf.layers.dense({ units: units, activation: 'relu' }));
    }
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
    return model;
}

function shuffle(array: any[]) {
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

function binarize(y: any, threshold = .5) {
    if (threshold == null) {
        threshold = 0.5;
    }
    tf.util.assert(
        threshold >= 0 && threshold <= 1,
        () => `Expected threshold to be >=0 and <=1, but got ${threshold}`);

    return tf.tidy(() => {
        const condition = y.greater(tf.scalar(threshold));
        return tf.where(condition, tf.onesLike(y), tf.zerosLike(y));
    });
}
*/

export = router;