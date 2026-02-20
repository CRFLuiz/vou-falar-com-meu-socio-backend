module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.name) {
      await queryInterface.addColumn('users', 'name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.professional_title) {
      await queryInterface.addColumn('users', 'professional_title', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table.professional_description) {
      await queryInterface.addColumn('users', 'professional_description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');

    if (table.professional_description) {
      await queryInterface.removeColumn('users', 'professional_description');
    }
    if (table.professional_title) {
      await queryInterface.removeColumn('users', 'professional_title');
    }
    if (table.name) {
      await queryInterface.removeColumn('users', 'name');
    }
  },
};
