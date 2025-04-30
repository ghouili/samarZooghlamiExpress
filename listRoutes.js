const express = require('express');
const app = express();
const userRoutes = require('./routes/user'); 

app.use(express.json());
app.use('/user', userRoutes);

// List all endpoints
const listEndpoints = require('express-list-endpoints');
console.log(listEndpoints(app));

// Prevent the script from running a server
process.exit(0);