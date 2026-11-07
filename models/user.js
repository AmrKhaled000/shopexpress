const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  resetToken: String,
  resetTokenExpiration: Date,
  cart: {
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        quantity: { type: Number, required: true }
      }
    ]
  }
});

userSchema.methods.addToCart = function(product, quantity = 1) {
  const amount =
    Number.isInteger(quantity) && quantity > 0 ? Math.min(quantity, 10) : 1;
  const cartProductIndex = this.cart.items.findIndex(cp => {
    return cp.productId.toString() === product._id.toString();
  });
  const updatedCartItems = [...this.cart.items];

  if (cartProductIndex >= 0) {
    updatedCartItems[cartProductIndex].quantity = Math.min(
      updatedCartItems[cartProductIndex].quantity + amount,
      10
    );
  } else {
    updatedCartItems.push({
      productId: product._id,
      quantity: Math.min(amount, 10)
    });
  }
  this.cart = {
    items: updatedCartItems
  };
  return this.save();
};

userSchema.methods.updateCartQuantity = function(productId, delta) {
  const item = this.cart.items.find(cp => {
    return cp.productId.toString() === productId.toString();
  });

  if (!item) {
    return Promise.resolve(this);
  }

  const nextQuantity = item.quantity + delta;
  if (nextQuantity <= 0) {
    this.cart.items = this.cart.items.filter(cp => {
      return cp.productId.toString() !== productId.toString();
    });
  } else {
    item.quantity = Math.min(nextQuantity, 10);
  }

  return this.save();
};

userSchema.methods.removeFromCart = function(productId) {
  const updatedCartItems = this.cart.items.filter(item => {
    return item.productId.toString() !== productId.toString();
  });
  this.cart.items = updatedCartItems;
  return this.save();
};

userSchema.methods.clearCart = function() {
  this.cart = { items: [] };
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
