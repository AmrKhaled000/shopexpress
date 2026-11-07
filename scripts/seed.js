'use strict';

/**
 * Development seed.
 * Creates the admin account, a demo customer, a considered catalog, and one
 * sample order so every page can be reviewed with realistic content.
 *
 * Usage: npm run seed
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopexpress';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@shopexpress.com').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@shopexpress.com').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

const products = [
  {
    title: 'Arc Task Lamp',
    price: 189,
    imageUrl: '/images/products/arc-task-lamp.svg',
    description:
      'A sweeping powder-coated steel lamp with a warm, dimmable pool of light. Designed for late pages and early mornings, with a weighted base that holds its ground on the smallest desk.'
  },
  {
    title: 'Meridian Headphones',
    price: 299,
    imageUrl: '/images/products/meridian-headphones.svg',
    description:
      'Closed-back headphones with a quiet, balanced signature and memory-foam cups. Built for long listening sessions that don’t ask for attention.'
  },
  {
    title: 'Terra Mug',
    price: 34,
    imageUrl: '/images/products/terra-mug.svg',
    description:
      'Hand-thrown stoneware in a soft clay glaze. Each 12 oz mug keeps heat, sits comfortably in the hand, and carries the small variations of the maker.'
  },
  {
    title: 'Form Keyboard',
    price: 159,
    imageUrl: '/images/products/form-keyboard.svg',
    description:
      'A compact mechanical keyboard with tactile switches, a machined aluminium body, and a layout that leaves room for your hands to think.'
  },
  {
    title: 'Drift Weekender',
    price: 225,
    imageUrl: '/images/products/drift-weekender.svg',
    description:
      'A canvas-and-leather holdall sized for two nights away. Waxed cotton shrugs off weather; the leather handles soften with every trip.'
  },
  {
    title: 'Halo Speaker',
    price: 129,
    imageUrl: '/images/products/halo-speaker.svg',
    description:
      'A small room speaker with a warm, room-filling sound. One dial, no app, and a woven grille that disappears into the shelf.'
  },
  {
    title: 'Linen Throw',
    price: 89,
    imageUrl: '/images/products/linen-throw.svg',
    description:
      'Stonewashed European linen, woven in a muted clay stripe. Light enough for summer, warm enough for the chair you keep meaning to leave.'
  },
  {
    title: 'Mono Watch',
    price: 249,
    imageUrl: '/images/products/mono-watch.svg',
    description:
      'A quiet automatic watch with a brushed steel case, a sandblasted dial, and a single crown. The seconds hand sweeps; everything else stays still.'
  },
  {
    title: 'Kanso Bottle',
    price: 48,
    imageUrl: '/images/products/kanso-bottle.svg',
    description:
      'Double-walled stainless steel with a matte, grippy finish. Holds 24 oz, keeps cold for a full day, and fits the cup holder you actually use.'
  },
  {
    title: 'Field Notebook',
    price: 28,
    imageUrl: '/images/products/field-notebook.svg',
    description:
      'A cloth-bound notebook with 192 dot-grid pages and a lay-flat binding. The kind of object that becomes more useful the more it is used.'
  }
];

async function ensureUser(email, password, isAdmin) {
  const existing = await User.findOne({ email });
  if (existing) {
    if (isAdmin && !existing.isAdmin) {
      existing.isAdmin = true;
      await existing.save();
    }
    return { user: existing, created: false };
  }
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await new User({
    email,
    password: hashedPassword,
    isAdmin,
    cart: { items: [] }
  }).save();
  return { user, created: true };
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('The seed script is development-only and will not run in production.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const { user: admin, created: adminCreated } = await ensureUser(ADMIN_EMAIL, ADMIN_PASSWORD, true);
  const { user: demo, created: demoCreated } = await ensureUser(DEMO_EMAIL, DEMO_PASSWORD, false);

  let createdProducts = 0;
  const seededProducts = [];

  for (const data of products) {
    let product = await Product.findOne({ title: data.title });
    if (!product) {
      product = await new Product({ ...data, userId: admin._id }).save();
      createdProducts += 1;
    }
    seededProducts.push(product);
  }

  let createdOrder = false;
  const existingOrder = await Order.findOne({ 'user.userId': demo._id });
  if (!existingOrder && seededProducts.length >= 2) {
    const picks = [seededProducts[0], seededProducts[2]];
    const orderProducts = picks.map((product, index) => ({
      quantity: index === 0 ? 1 : 2,
      product: { ...product._doc }
    }));
    const total = picks.reduce(
      (sum, product, index) => sum + product.price * (index === 0 ? 1 : 2),
      0
    );
    await new Order({
      user: { email: demo.email, userId: demo._id },
      products: orderProducts,
      total: parseFloat(total.toFixed(2))
    }).save();
    createdOrder = true;
  }

  console.log('');
  console.log('  ShopExpress seed complete');
  console.log('  -------------------------');
  console.log(`  Catalog: ${seededProducts.length} products (${createdProducts} new)`);
  console.log(`  Admin:   ${ADMIN_EMAIL}${adminCreated ? ` (password: ${ADMIN_PASSWORD})` : ' (existing)'}`);
  console.log(`  Demo:    ${DEMO_EMAIL}${demoCreated ? ` (password: ${DEMO_PASSWORD})` : ' (existing)'}`);
  console.log(`  Order:   ${createdOrder ? 'sample order created' : 'already present or skipped'}`);
  console.log('');

  await mongoose.disconnect();
}

main().catch(async error => {
  console.error('Seed failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    /* ignore */
  }
  process.exit(1);
});
