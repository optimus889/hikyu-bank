package hikyubank.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** A reviewed cloud cutover must not happen merely by opening a new ZIP. */
@Configuration
public class UuidMigrationConfiguration {
    @Bean
    public FlywayMigrationStrategy guardedMigration(
        @Value("${hikyu.database-mode:local}") String mode,
        @Value("${hikyu.uuid-migration-approved:false}") boolean approved,
        @Value("${hikyu.extension-migration-approved:false}") boolean extensionApproved
    ) {
        return flyway -> {
            if ("cloud".equals(mode) && !approved) {
                try (var connection = flyway.getConfiguration().getDataSource().getConnection();
                     var statement = connection.prepareStatement("""
                         SELECT data_type FROM information_schema.columns
                         WHERE table_schema = 'hikyu' AND table_name = 'users' AND column_name = 'id'
                         """);
                     var result = statement.executeQuery()) {
                    if (result.next() && "text".equals(result.getString(1))) {
                        throw new IllegalStateException(
                            "Cloud UUID cutover is not approved. Verify a backup and review V2-V4 first. "
                            + "Then set HIKYU_UUID_MIGRATION_APPROVED=true in .env.supabase."
                        );
                    }
                } catch (java.sql.SQLException error) {
                    throw new IllegalStateException("Cannot inspect cloud migration readiness.", error);
                }
            }
            if (!extensionApproved) {
                try (var connection = flyway.getConfiguration().getDataSource().getConnection();
                     var statement = connection.prepareStatement("SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='hikyu' AND table_name='users' AND column_name='id') AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='hikyu' AND table_name='users' AND column_name='auth_version')");
                     var result = statement.executeQuery()) {
                    if (result.next() && result.getBoolean(1)) throw new IllegalStateException("V5 migration is not approved for this existing database. Test a separate copy and set HIKYU_EXTENSION_MIGRATION_APPROVED=true only for an intended upgrade.");
                } catch (java.sql.SQLException e) { throw new IllegalStateException("Cannot inspect extension migration readiness.",e); }
            }
            flyway.migrate();
        };
    }
}
