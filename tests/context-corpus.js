// A synthetic lecture for the translation-context tests and tools/context-eval.js: written for this
// purpose (no real transcript is kept in the repo), cut into ~2 s caption cues the way auto captions
// are, and carrying the cases the context package must get right: a pronoun whose antecedent is one
// sentence back ("Sam ... He"), an ellipsis ("The first approach ... The second"), a discourse link
// ("This is important. However"), a clause split across cues ("After we finish this step, / we can
// move on"), a pronoun whose antecedent is three sentences back ("Maria Lopez ... she"), a repeated entity ("The company ... The company ... It") and repeated terms ("model").
const TEXT = `Welcome back to the course. In this lesson we will look at how a language model is trained.
Sam joined the company in 2019. He later became the CEO, and he pushed the team to build its own model.
The first approach is expensive. The second is faster, but it needs more data.
The model was trained on a large dataset of web pages. It learned to predict the next token.
This is important. However, there is another problem that we need to talk about.
After we finish this step, we can move on to the next one, which is evaluation.
I think this is important because most people skip it.
The company released the system last year. The company then opened it to developers. It quickly became popular.
Maria Lopez leads the research group at the lab. The group has twelve members. Most of them work on computer vision.
Last year, she moved the whole team to language models, and the results surprised everyone.
Now let's go over the training loop in a bit more detail.
First, we take a batch of examples from the training set. Then we run a forward pass through the network.
We compute the loss, and we use gradient descent to update the weights.
If the learning rate is too large, the loss may go up instead of down, and the model will fail to converge.
So in practice, you usually start with a small learning rate and increase it slowly.
At this point, you might ask why we don't just use a bigger model.
The short answer is cost. A bigger model needs more memory, more compute and more time.
That being said, bigger models do tend to generalize better, at least up to a point.
Let's take a look at a concrete example to make this clearer.
Suppose we want to classify customer reviews as positive or negative.
We collect ten thousand reviews and label each one by hand.
Then we split the data into a training set, a validation set and a test set.
We fine-tune the model on the training set for three epochs.
After every epoch, we check the validation loss to see whether the model is overfitting.
If the validation loss starts to go up while the training loss keeps going down, that is a sign of overfitting.
In that case, we stop training early and keep the best checkpoint.
This technique is called early stopping, and it is one of the simplest ways to fight overfitting.
Another way is regularization. It adds a penalty to large weights so that the model stays simple.
Dropout is a third option. It randomly turns off some neurons during training.
Keep in mind that none of these methods is a silver bullet.
You still need good data, and you still need to look at your results carefully.
Once the model is trained, we evaluate it on the test set.
The test set must never be used during training, or the numbers will be too optimistic.
On our review data, the fine-tuned model reached ninety two percent accuracy.
That is a big jump from the seventy percent we got with a simple baseline.
But accuracy alone does not tell the whole story.
We also need to look at precision and recall, especially when the classes are imbalanced.
For example, if only five percent of the reviews are negative, a model that always says positive gets ninety five percent accuracy.
Clearly, that model is useless, even though its accuracy looks great.
So always compare your model against a simple baseline before you celebrate.
In the next lesson, we will deploy the model and serve it behind an API.
We will also talk about how to monitor it once real users start sending requests.
Thanks for watching, and see you in the next video.`;

function cues() {
    const out = [];
    let t = 0;
    for (const para of TEXT.split("\n")) {
        const words = para.split(/\s+/);
        let cur = [];
        for (const w of words) {
            cur.push(w);
            const s = cur.join(" ");
            if (s.length >= 38 || /[.!?]$/.test(w) && s.length > 20) {
                const d = Math.max(1.2, s.length / 16);
                out.push({ start: +t.toFixed(2), end: +(t + d).toFixed(2), text: s });
                t += d + 0.05; cur = [];
            }
        }
        if (cur.length) { const s = cur.join(" "); const d = Math.max(1, s.length / 16); out.push({ start: +t.toFixed(2), end: +(t + d).toFixed(2), text: s }); t += d + 0.05; }
        t += 0.4;
    }
    return out;
}
module.exports = { TEXT, cues };
