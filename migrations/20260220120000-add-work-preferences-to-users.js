module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('users');

    if (!table.rate) {
      await queryInterface.addColumn('users', 'rate', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      });
    }

    if (!table.hours_per_day) {
      await queryInterface.addColumn('users', 'hours_per_day', {
        type: Sequelize.DECIMAL(4, 2),
        allowNull: true,
      });
    }

    if (!table.days_per_week) {
      await queryInterface.addColumn('users', 'days_per_week', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    if (!table.level) {
      await queryInterface.addColumn('users', 'level', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('users');

    if (table.level) {
      await queryInterface.removeColumn('users', 'level');
    }
    if (table.days_per_week) {
      await queryInterface.removeColumn('users', 'days_per_week');
    }
    if (table.hours_per_day) {
      await queryInterface.removeColumn('users', 'hours_per_day');
    }
    if (table.rate) {
      await queryInterface.removeColumn('users', 'rate');
    }
  },
};

