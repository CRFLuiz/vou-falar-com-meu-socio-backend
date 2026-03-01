module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('projects');

    if (!table.user_id) {
      await queryInterface.addColumn('projects', 'user_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('projects');

    if (table.user_id) {
      await queryInterface.removeColumn('projects', 'user_id');
    }
  },
};
