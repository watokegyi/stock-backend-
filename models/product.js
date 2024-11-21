
module.exports = (sequelize, Sequelize) => {
  const Product = sequelize.define(
    "product_list",
    {
      no: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      product_name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      sku: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      color: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      imgurl: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      product_t_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "productkinds", 
          key: "id", 
        },
      },
      price:{ 
        type:Sequelize.INTEGER,
        allowNull:false
      }
    },

    {
      tableName: "product_list",
      timestamps: false,
    }
  );

  Product.associate = (models) => {
    Product.belongsTo(models.ProductKind, {
      foreignKey: "product_t_id",
      as: "productkinds",
    });
  };

  return Product;
};
