using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Relay.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddMetadataFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "Series",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "Series",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalId",
                table: "MediaItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalSource",
                table: "MediaItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MetadataProvider",
                table: "Libraries",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "Series");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "Series");

            migrationBuilder.DropColumn(
                name: "ExternalId",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "ExternalSource",
                table: "MediaItems");

            migrationBuilder.DropColumn(
                name: "MetadataProvider",
                table: "Libraries");
        }
    }
}
