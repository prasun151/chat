import jax
import jax.numpy as jnp
from jax import grad, jit

class LinearRegressionJAX:
    def __init__(self, learning_rate=0.01, n_iters=1000):
        self.learning_rate = learning_rate
        self.n_iters = n_iters
        self.W = None
        self.b = None

    def fit(self, X, y):
        n_samples, n_features = X.shape
        key = jax.random.PRNGKey(0)
        self.W = jax.random.normal(key, (n_features,))
        self.b = 0.0

        def loss_fn(params, X, y):
            W, b = params
            y_pred = jnp.dot(X, W) + b
            return jnp.mean((y - y_pred) ** 2)

        grad_loss = jit(grad(loss_fn, argnums=0))
        params = (self.W, self.b)

        for _ in range(self.n_iters):
            grads = grad_loss(params, X, y)
            params = (
                params[0] - self.learning_rate * grads[0],
                params[1] - self.learning_rate * grads[1],
            )
        self.W, self.b = params

    def predict(self, X):
        return jnp.dot(X, self.W) + self.b