const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const ocRoutes = require('./modules/ocs/oc.routes');
const healthRoutes = require('./modules/health/health.routes');
const empresaRoutes = require('./modules/empresas/empresa.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const { apiLimiter, loginLimiter } = require('./middlewares/rateLimiter');
const { requestBodyLimit, helmetOptions, swaggerHelmetOptions } = require('./config/security');

const app = express();
const swaggerUiHandler = swaggerUi.setup(swaggerSpec);

app.disable('x-powered-by');
app.use('/docs', helmet(swaggerHelmetOptions));
app.get('/docs', (req, res, next) => {
  if (req.path !== '/docs') {
    return next();
  }

  res.redirect('/docs/');
});
app.get('/docs/', swaggerUiHandler);
app.use('/docs', swaggerUi.serve);
app.get('/docs.json', (req, res) => {
  res.json(swaggerSpec);
});

app.use(helmet(helmetOptions));
app.use(cors());
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: requestBodyLimit }));
app.use(requestLogger);

app.use(healthRoutes);

app.use(apiLimiter);
app.use('/users/login', loginLimiter);
app.use(authRoutes);
app.use('/users', userRoutes);
app.use('/ocs', ocRoutes);
app.use('/empresas', empresaRoutes);
app.use('/audit', auditRoutes);

app.get('/', (req, res) => {
  res.send('API rodando normalmente');
});

app.use(errorHandler);

module.exports = app;
