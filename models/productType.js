// models/ProductKind.js

module.exports = (sequelize, Sequelize) => {
  const ProductKind = sequelize.define(
    "ProductKind",
    {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      productype: {
        type: Sequelize.STRING,
        allowNull: false,
      },  
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      colors: {
        type: Sequelize.ARRAY(Sequelize.TEXT), 
        allowNull: true,
      },
      size: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
      },

      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "productkinds",
      timestamps: false,
    }
  );

  ProductKind.associate = (models) => {
    ProductKind.hasMany(models.Product, {
      as: "product_list",
      foreignKey: "product_t_id",
    });
  };

  return ProductKind;
};
