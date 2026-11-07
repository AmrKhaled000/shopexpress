'use strict';

const Product = require('../models/product');

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

function invalidProductRedirect(req, res) {
  req.flash('error', 'That product could not be found in your catalog.');
  return res.redirect('/admin/products');
}

exports.getAddProduct = (req, res) => {
  res.render('admin/edit-product', {
    pageTitle: 'Add product',
    path: '/admin/add-product',
    editing: false,
    errorMessage: null,
    validationErrors: {},
    form: {
      title: '',
      imageUrl: '',
      price: '',
      description: ''
    },
    product: null
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = (req.body.title || '').trim();
  const imageUrl = (req.body.imageUrl || '').trim();
  const price = parseFloat(req.body.price);
  const description = (req.body.description || '').trim();

  const validationErrors = validateProduct({ title, imageUrl, price, description });

  if (Object.keys(validationErrors).length > 0) {
    return res.status(422).render('admin/edit-product', {
      pageTitle: 'Add product',
      path: '/admin/add-product',
      editing: false,
      errorMessage: 'Please fix the highlighted fields below.',
      validationErrors,
      form: { title, imageUrl, price: req.body.price, description },
      product: null
    });
  }

  const product = new Product({
    title,
    price,
    description,
    imageUrl,
    userId: req.user
  });

  product
    .save()
    .then(() => {
      req.flash('success', 'Product created and published to the storefront.');
      res.redirect('/admin/products');
    })
    .catch(next);
};

exports.getEditProduct = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect('/admin/products');
  }

  const prodId = req.params.productId;
  if (!OBJECT_ID.test(prodId)) {
    return invalidProductRedirect(req, res);
  }

  Product.findById(prodId)
    .then(product => {
      if (!product || product.userId.toString() !== req.user._id.toString()) {
        req.flash('error', 'That product could not be found in your catalog.');
        return res.redirect('/admin/products');
      }
      res.render('admin/edit-product', {
        pageTitle: 'Edit product',
        path: '/admin/edit-product',
        editing: true,
        product,
        errorMessage: null,
        validationErrors: {},
        form: null
      });
    })
    .catch(next);
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  if (!OBJECT_ID.test(String(prodId || ''))) {
    return invalidProductRedirect(req, res);
  }

  const title = (req.body.title || '').trim();
  const price = parseFloat(req.body.price);
  const imageUrl = (req.body.imageUrl || '').trim();
  const description = (req.body.description || '').trim();
  const validationErrors = validateProduct({ title, imageUrl, price, description });

  Product.findById(prodId)
    .then(product => {
      if (!product || product.userId.toString() !== req.user._id.toString()) {
        req.flash('error', 'That product could not be found in your catalog.');
        return res.redirect('/admin/products');
      }

      if (Object.keys(validationErrors).length > 0) {
        return res.status(422).render('admin/edit-product', {
          pageTitle: 'Edit product',
          path: '/admin/edit-product',
          editing: true,
          product,
          errorMessage: 'Please fix the highlighted fields below.',
          validationErrors,
          form: { title, imageUrl, price: req.body.price, description }
        });
      }

      product.title = title;
      product.price = price;
      product.description = description;
      product.imageUrl = imageUrl;

      return product.save().then(() => {
        req.flash('success', 'Product updated.');
        res.redirect('/admin/products');
      });
    })
    .catch(next);
};

exports.getProducts = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .sort({ _id: -1 })
    .then(products => {
      const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
      const stats = products.reduce(
        (result, product) => {
          result.totalValue += Number(product.price) || 0;
          if (product._id.getTimestamp().getTime() > thirtyDaysAgo) {
            result.recentCount += 1;
          }
          return result;
        },
        { totalValue: 0, recentCount: 0 }
      );
      stats.totalValue = parseFloat(stats.totalValue.toFixed(2));
      stats.averagePrice = products.length
        ? parseFloat((stats.totalValue / products.length).toFixed(2))
        : 0;

      res.render('admin/products', {
        prods: products,
        stats,
        pageTitle: 'Admin · Catalog',
        pageDescription: 'Manage the ShopExpress catalog.',
        path: '/admin/products'
      });
    })
    .catch(next);
};

exports.postDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;

  if (!OBJECT_ID.test(String(prodId || ''))) {
    return invalidProductRedirect(req, res);
  }

  Product.deleteOne({ _id: prodId, userId: req.user._id })
    .then(result => {
      if (!result.deletedCount) {
        req.flash('error', 'That product could not be found in your catalog.');
      } else {
        req.flash('success', 'Product deleted from the catalog.');
      }
      res.redirect('/admin/products');
    })
    .catch(next);
};

function validateProduct({ title, imageUrl, price, description }) {
  const errors = {};
  if (!title || title.length < 3) {
    errors.title = 'Title must be at least 3 characters.';
  } else if (title.length > 120) {
    errors.title = 'Title must be 120 characters or fewer.';
  }
  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    errors.imageUrl = 'Enter a hosted image URL or a path under /images/.';
  }
  if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'Price must be a positive number.';
  }
  if (!description || description.length < 10) {
    errors.description = 'Description must be at least 10 characters.';
  } else if (description.length > 2000) {
    errors.description = 'Description must be 2,000 characters or fewer.';
  }
  return errors;
}

function isValidImageUrl(value) {
  if (
    value.indexOf('..') === -1 &&
    /^\/images\/[A-Za-z0-9/_.,-]+\.(svg|png|jpe?g|webp|avif|gif)$/i.test(value)
  ) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}
