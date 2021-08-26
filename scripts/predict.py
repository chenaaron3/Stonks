from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score
from sklearn import svm
import json
import os
from joblib import dump, load

import tensorflow as tf
import tensorflow.keras
import numpy as np

id = "UYXLvRNhcT"  # EMA/MACD/RSI
id = "nVw0EBbyTR"  # MACD/RSI
dir = os.path.dirname(__file__)

print(dir)

# Load dataset
data = json.load(open(os.path.join(dir, "..", "dist", "data", id + ".json"), "r"))

# Organize our data
labels = data['labels']
features = data['features']

# Split our data
train, test, train_labels, test_labels = train_test_split(features,
                                                          labels,
                                                          test_size=0.3,
                                                          random_state=42)

train = np.array(train)
test = np.array(test)
train_labels = np.array(train_labels)
test_labels = np.array(test_labels)

print("Building model..")
model = tf.keras.Sequential()
model.add(tf.keras.layers.Dense(96, activation="relu"))
model.add(tf.keras.layers.Dense(96, activation="relu"))
model.compile(optimizer='adam',
              loss='sparse_categorical_crossentropy', metrics=['accuracy'])

model.fit(train, train_labels, epochs=100, batch_size=32)

test_loss, test_acc = model.evaluate(test, test_labels)

print('Test accuracy:', test_acc)

# classifiers = []
# classifiers.append(svm.SVC())
# classifiers.append(MLPClassifier(solver='lbfgs', alpha=1e-5,hidden_layer_sizes=(5, 2), random_state=1))
# classifiers.append(MLPClassifier(solver='lbfgs', alpha=1e-5,hidden_layer_sizes=(100, 5), random_state=1))

# for classifier in classifiers:
#     # Train our classifier
#     model = classifier.fit(train, train_labels)
#     # Make predictions
#     preds = classifier.predict(test)
#     # Evaluate accuracy
#     print(classifier, accuracy_score(test_labels, preds))
#     dump(classifier, id + "-" + type(classifier).__name__ + '.joblib')
