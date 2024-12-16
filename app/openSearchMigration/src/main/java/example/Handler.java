package example;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.senacor.elasticsearch.evolution.core.ElasticsearchEvolution;
<<<<<<< HEAD
=======
import example.utils.AwsRequestSigningApacheInterceptor;
>>>>>>> recovery-branch
import lombok.extern.slf4j.Slf4j;
import org.apache.http.HttpHost;
import org.apache.http.HttpRequestInterceptor;
import org.elasticsearch.client.RestClient;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
<<<<<<< HEAD
import software.amazon.awssdk.auth.signer.Aws4Signer;
=======
import software.amazon.awssdk.http.auth.aws.signer.AwsV4HttpSigner;
>>>>>>> recovery-branch

import java.util.Arrays;
import java.util.Collections;
import java.util.Map;

// Handler value: example.Handler
@Slf4j
public class Handler implements RequestHandler<Map<String, String>, Void> {

    @Override
    public Void handleRequest(Map<String, String> event, Context context) {
        LambdaLogger logger = context.getLogger();
        executeOpensearchScripts();
        return null;
    }

    private void executeOpensearchScripts() {
        ElasticsearchEvolution elasticsearchEvolution = ElasticsearchEvolution.configure()
                .setEnabled(true) // true or false
                .setLocations(Arrays.asList("classpath:opensearch_migration/base", "classpath:opensearch_migration/dev")) // List of all locations where scripts are located.
                .setHistoryIndex("opensearch_changelog") // Tracker index to store history of scripts executed.
                .setValidateOnMigrate(false) // true or false
                .setOutOfOrder(true) // true or false
                .setPlaceholders(Collections.singletonMap("env", "dev")) // list of placeholders which will get replaced in the script during execution.
                .load(getOpenSearchEvolutionRestClient());
        elasticsearchEvolution.migrate();
    }

    private RestClient getOpenSearchEvolutionRestClient() {
        return RestClient.builder(getHttpHost())
                .setHttpClientConfigCallback(hacb -> hacb.addInterceptorLast(getAwsRequestSigningInterceptor()))
                .build();
    }

    private HttpHost getHttpHost() {
<<<<<<< HEAD
        //Replace sample-endpoint with your own OpenSearch endpoint
        return HttpHost.create("https://<<sample-endpoint>>.amazonaws.com");
=======
        return HttpHost.create(System.getenv("OPENSEARCH_DOMAIN_ENDPOINT"));
>>>>>>> recovery-branch
    }

    private HttpRequestInterceptor getAwsRequestSigningInterceptor() {
        return new AwsRequestSigningApacheInterceptor(
                "es",
<<<<<<< HEAD
                Aws4Signer.create(),
                DefaultCredentialsProvider.create(),
                "us-east-2");
=======
                AwsV4HttpSigner.create(),
                DefaultCredentialsProvider.create(),
                System.getenv("AWS_REGION"));
>>>>>>> recovery-branch
    }

}