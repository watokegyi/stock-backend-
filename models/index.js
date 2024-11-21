


const Sequelize = require("sequelize");
const config = require("../config/config.js");


const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
});



const models = {
  Product: require("./product.js")(sequelize, Sequelize),
  ProductKind: require("./productType.js")(sequelize, Sequelize),
};


Object.keys(models).forEach((modelName)=>{ 
  if(models[modelName].associate){ 
    models[modelName].associate(models);
  }
});


models.sequelize=sequelize;
models.Sequelize=Sequelize;





module.exports=models;
